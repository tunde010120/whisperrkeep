"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { startRegistration } from "@simplewebauthn/browser";
import { AppwriteService } from "@/lib/appwrite";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { masterPassCrypto } from "@/app/(protected)/masterpass/logic";

interface PasskeySetupProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trustUnlocked?: boolean;
}

// Helper to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function PasskeySetup({
  isOpen,
  onClose,
  userId,
  onSuccess,
  trustUnlocked = false,
}: PasskeySetupProps) {
  const [step, setStep] = useState(trustUnlocked && masterPassCrypto.isVaultUnlocked() ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const verifyMasterPassword = async () => {
    if (!masterPassword.trim()) {
      toast.error("Please enter your master password.");
      return false;
    }
    
    setVerifyingPassword(true);
    try {
      const isValid = await masterPassCrypto.unlock(masterPassword, userId);
      if (isValid) {
        return true;
      } else {
        toast.error("Incorrect master password.");
        return false;
      }
    } catch (error) {
      console.error("Password verification failed:", error);
      toast.error("Failed to verify master password.");
      return false;
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleContinueToName = async () => {
    const isValid = await verifyMasterPassword();
    if (isValid) {
      setStep(2);
    }
  };

  const handleContinueToCreate = () => {
    if (!passkeyName.trim()) {
      toast.error("Please name your passkey.");
      return;
    }
    setStep(3);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      let masterKey = masterPassCrypto.getMasterKey();
      
      if (!masterKey && masterPassword) {
          // Ensure we are unlocked if we have the password
          await masterPassCrypto.unlock(masterPassword, userId);
          masterKey = masterPassCrypto.getMasterKey();
      }

      if (!masterKey) {
          throw new Error("Vault is locked. Please enter master password.");
      }

      // 1. Generate WebAuthn registration first to get credential data
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = arrayBufferToBase64(challenge.buffer);

      const userIdBytes = new TextEncoder().encode(userId);
      const registrationOptions = {
        challenge: challengeBase64,
        rp: {
          name: "WhisperAuth",
          id: window.location.hostname,
        },
        user: {
          id: arrayBufferToBase64(userIdBytes.buffer as ArrayBuffer),
          name: userId,
          displayName: userId,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" as const }, { alg: -257, type: "public-key" as const }],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          residentKey: "required" as const,
          userVerification: "preferred" as const,
        },
        timeout: 60000,
        attestation: "none" as const,
      };

      // 2. Start WebAuthn registration
      const regResp = await startRegistration(registrationOptions);

      // 3. Derive Kwrap from WebAuthn credential data
      const encoder = new TextEncoder();
      const credentialData = encoder.encode(regResp.id + userId);
      const kwrapSeed = await crypto.subtle.digest("SHA-256", credentialData);
      const kwrap = await crypto.subtle.importKey(
        "raw",
        kwrapSeed,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );

      // 4. Export master key and encrypt it with Kwrap
      const rawMasterKey = await crypto.subtle.exportKey("raw", masterKey);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedMasterKey = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        kwrap,
        rawMasterKey,
      );

      // 5. Combine IV + encrypted key for passkeyBlob
      const combined = new Uint8Array(
        iv.length + encryptedMasterKey.byteLength,
      );
      combined.set(iv);
      combined.set(new Uint8Array(encryptedMasterKey), iv.length);
      const passkeyBlob = arrayBufferToBase64(combined.buffer);

      // 6. Store credential and encrypted blob
      // Note: We do NOT delete existing passkeys anymore.
      
      await AppwriteService.createKeychainEntry({
        userId,
        type: 'passkey',
        credentialId: regResp.id,
        wrappedKey: passkeyBlob,
        salt: "", 
        params: JSON.stringify({
          name: passkeyName,
          publicKey: regResp.response.publicKey || "",
          counter: 0,
          transports: regResp.response.transports || [],
          created: new Date().toISOString(),
        }),
        isBackup: false
      });

      // Update user doc flags for UI consistency
      await AppwriteService.syncPasskeyStatus(userId);

      setStep(4); // Success step
    } catch (error: unknown) {
      console.error("Passkey setup failed:", error);
      const err = error as { name?: string; message?: string };
      const message =
        err.name === "InvalidStateError"
          ? "This passkey is already registered."
          : err.message;
      toast.error(`Failed to create passkey: ${message}`);
    }
    setLoading(false);
  };

  const resetDialog = () => {
    setStep(1);
    setLoading(false);
    setMasterPassword("");
    setPasskeyName("");
    setShowPassword(false);
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <div className="p-6 w-96">
        <h2 className="text-lg font-semibold mb-4">Add New Passkey</h2>
        <div className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-3">
                <h3 className="font-medium">Step 1: Verify Master Password</h3>
                <p className="text-sm text-gray-600">
                  Please verify your master password to continue.
                </p>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Master Password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleContinueToName()}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleContinueToName}
                  disabled={!masterPassword.trim() || verifyingPassword}
                >
                  {verifyingPassword ? "Verifying..." : "Continue"}
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-3">
                <h3 className="font-medium">Step 2: Name Passkey</h3>
                <p className="text-sm text-gray-600">
                  Give this passkey a name to identify it later (e.g., "MacBook Pro", "iPhone").
                </p>
                <Input
                  type="text"
                  placeholder="Passkey Name"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContinueToCreate()}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={handleContinueToCreate}
                  disabled={!passkeyName.trim()}
                >
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-3">
                <h3 className="font-medium">Step 3: Create Passkey</h3>
                <p className="text-sm text-gray-600">
                  Click "Create Passkey" and follow your device's prompts.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Face ID / Touch ID</li>
                  <li>• Windows Hello</li>
                  <li>• Security Key</li>
                </ul>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={loading}>
                  {loading ? "Creating..." : "Create Passkey"}
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-3">
                <h3 className="font-medium text-green-700">
                  ✓ Passkey Added!
                </h3>
                <p className="text-sm text-gray-600">
                  You can now use <strong>{passkeyName}</strong> to unlock your vault.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    onSuccess();
                    handleClose();
                  }}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
