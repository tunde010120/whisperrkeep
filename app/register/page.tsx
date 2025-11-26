"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppwrite } from "@/app/appwrite-provider";
import { registerWithEmailPassword, loginWithEmailPassword, setMasterpassFlag, AppwriteService } from "@/lib/appwrite";
import { masterPassCrypto } from "@/app/(protected)/masterpass/logic";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import toast from "react-hot-toast";
import { Lock, Mail, User } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAppwrite();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      // 1. Create Account
      await registerWithEmailPassword(email, password, name);
      
      // 2. Login immediately
      const session = await loginWithEmailPassword(email, password);
      await refresh();

      // 3. Auto-unlock vault (set master password = login password)
      // We need the userId. The session object has userId.
      const userId = session.userId;
      
      // Initialize master password
      const success = await masterPassCrypto.unlock(password, userId, true);
      
      if (success) {
        // 4. Set flags
        await setMasterpassFlag(userId, email);
        
        // Set Auth v2 flags
        const userDoc = await AppwriteService.getUserDoc(userId);
        if (userDoc && userDoc.$id) {
            await AppwriteService.updateUserDoc(userDoc.$id, {
                authVersion: 2,
                v2Migrated: true,
                mustCreatePasskey: true
            });
        }

        toast.success("Account created successfully!");
        router.replace("/dashboard");
      } else {
        // Fallback if auto-unlock fails (shouldn't happen)
        toast.error("Account created, but failed to set master password. Please try logging in.");
        router.replace("/login");
      }

    } catch (error: any) {
      console.error("Registration failed:", error);
      toast.error(error.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your details to create your secure vault
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                  minLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This password will be used to encrypt your vault. Do not forget it.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
          <div>
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
