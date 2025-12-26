"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Home,
  PlusCircle,
  Share2,
  Upload,
} from "lucide-react";
import { Button, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Typography, Paper } from "@mui/material";
import { useTheme } from "@/app/providers";
import { useAppwrite } from "@/app/appwrite-provider";
import { masterPassCrypto } from "@/app/(protected)/masterpass/logic";
import { Navbar } from "./Navbar";
import dynamic from "next/dynamic";
import type { Models } from "appwrite";

const PasskeySetup = dynamic(() => import("@/components/overlays/passkeySetup").then(mod => mod.PasskeySetup), { ssr: false });

interface ExtendedUser extends Models.User<Models.Preferences> {
  isPasskey?: boolean;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Sharing", href: "/sharing", icon: Share2 },
  { name: "New", href: "/credentials/new", icon: PlusCircle, big: true },
  { name: "TOTP", href: "/totp", icon: Shield },
  { name: "Import", href: "/import", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
];

const SIMPLIFIED_LAYOUT_PATHS = [
  "/",
  "/masterpass",
  "/masterpass/reset",
  "/twofa/access",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading, logout, refresh } = useAppwrite();
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);

  const isSimplifiedLayout = SIMPLIFIED_LAYOUT_PATHS.includes(pathname);

  useEffect(() => {
    if (user && !loading) {
      const extendedUser = user as ExtendedUser;
      const shouldEnforcePasskey =
        process.env.NEXT_PUBLIC_PASSKEY_ENFORCE === "true" && !extendedUser.isPasskey;
      if (shouldEnforcePasskey && masterPassCrypto.isVaultUnlocked()) {
        setShowPasskeySetup(true);
      }
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !user && !isSimplifiedLayout) {
      router.replace("/masterpass");
    }
  }, [loading, user, isSimplifiedLayout, router]);

  useEffect(() => {
    if (user && !isSimplifiedLayout) {
      masterPassCrypto.updateActivity();
      let intervalId: number | undefined;

      const keepAlive = () => masterPassCrypto.updateActivity();

      const startWatcher = () => {
        clearInterval(intervalId as number);
        intervalId = window.setInterval(() => {
          if (!masterPassCrypto.isVaultUnlocked()) {
            sessionStorage.setItem("masterpass_return_to", pathname);
            router.replace("/masterpass");
            clearInterval(intervalId as number);
          }
        }, 1000);
      };

      const handleActivity = () => keepAlive();

      window.addEventListener("mousemove", handleActivity);
      window.addEventListener("mousedown", handleActivity);
      window.addEventListener("keydown", handleActivity);
      window.addEventListener("scroll", handleActivity, { passive: true });
      window.addEventListener("touchstart", handleActivity, { passive: true });
      window.addEventListener("focus", handleActivity);
      window.addEventListener("click", handleActivity);

      const handleVisibility = () => {
        if (!masterPassCrypto.isVaultUnlocked()) {
          sessionStorage.setItem("masterpass_return_to", pathname);
          router.replace("/masterpass");
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      startWatcher();

      if (!masterPassCrypto.isVaultUnlocked()) {
        sessionStorage.setItem("masterpass_return_to", pathname);
        router.replace("/masterpass");
      }

      return () => {
        window.removeEventListener("mousemove", handleActivity);
        window.removeEventListener("mousedown", handleActivity);
        window.removeEventListener("keydown", handleActivity);
        window.removeEventListener("scroll", handleActivity);
        window.removeEventListener("touchstart", handleActivity);
        window.removeEventListener("focus", handleActivity);
        window.removeEventListener("click", handleActivity);
        document.removeEventListener("visibilitychange", handleVisibility);
        clearInterval(intervalId as number);
      };
    }
  }, [user, isSimplifiedLayout, pathname, router]);

  const ThemeIcon = () => {
    switch (theme) {
      case "light":
        return Sun;
      case "dark":
        return Moon;
      default:
        return Monitor;
    }
  };

  const ThemeSymbol = ThemeIcon();

  if (isSimplifiedLayout) {
    return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>{children}</Box>;
  }

  if (!loading && !user) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Navbar />

      <Box sx={{ flex: 1, display: 'flex', w: '100%', overflowX: 'hidden', pt: 8 }}>
        <Box
          component="aside"
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'fixed',
            left: 0,
            top: 64,
            height: 'calc(100vh - 64px)',
            width: 256,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowY: 'auto',
            zIndex: 30
          }}
          aria-label="Primary sidebar navigation"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', h: '100%' }}>
            <List sx={{ flex: 1, px: 1, py: 1.5 }}>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      component={Link}
                      href={item.href}
                      sx={{
                        borderRadius: 1,
                        bgcolor: isActive ? 'primary.main' : 'transparent',
                        color: isActive ? 'background.default' : 'text.primary',
                        '&:hover': {
                          bgcolor: isActive ? 'primary.dark' : 'rgba(255, 255, 255, 0.05)',
                        },
                        py: item.big ? 1.5 : 1
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                        <item.icon size={item.big ? 24 : 20} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        primaryTypographyProps={{
                          variant: item.big ? 'body1' : 'body2',
                          fontWeight: 600
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            <Divider />
            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Button
                variant="text"
                size="small"
                fullWidth
                startIcon={<ThemeSymbol size={18} />}
                onClick={() => {
                  const themes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
                  const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
                  setTheme(nextTheme);
                }}
                sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
              >
                {`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`}
              </Button>
              <Button
                variant="text"
                size="small"
                fullWidth
                startIcon={<Shield size={18} />}
                onClick={() => {
                  masterPassCrypto.lockNow();
                  if (!masterPassCrypto.isVaultUnlocked()) {
                    sessionStorage.setItem("masterpass_return_to", pathname);
                    router.replace("/masterpass");
                  }
                }}
                sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
              >
                Lock now
              </Button>
              <Button
                variant="text"
                size="small"
                fullWidth
                startIcon={<LogOut size={18} />}
                onClick={logout}
                sx={{ justifyContent: 'flex-start', color: 'error.main', '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.08)' } }}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden', ml: { lg: '256px' } }}>
          <Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 3, md: 4 }, py: 4, pb: { xs: 10, lg: 4 }, overflowX: 'hidden', maxWidth: '100%' }}>
            {children}
          </Box>
        </Box>
      </Box>

      <Paper
        component="nav"
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: { xs: 'flex', lg: 'none' },
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 64,
          pb: 'env(safe-area-inset-bottom)',
          boxSizing: 'content-box'
        }}
      >
        {navigation
          .filter((item) => item.name !== "Import")
          .map((item) => {
            const isActive = pathname === item.href;
            const isBig = item.big;

            if (isBig) {
              return (
                <Box
                  key={item.name}
                  component={Link}
                  href={item.href}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mt: -5,
                    textDecoration: 'none'
                  }}
                >
                  <Box
                    sx={{
                      h: 64,
                      w: 64,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'primary.main',
                      color: 'background.default',
                      border: '4px solid',
                      borderColor: 'background.default',
                      boxShadow: '0 4px 20px rgba(0, 240, 255, 0.4)',
                      transition: 'transform 0.2s',
                      '&:active': { transform: 'scale(0.95)' }
                    }}
                  >
                    <item.icon size={32} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, mt: 0.5, textTransform: 'uppercase', color: 'primary.main', fontSize: 10 }}>
                    {item.name}
                  </Typography>
                </Box>
              );
            }

            return (
              <Box
                key={item.name}
                component={Link}
                href={item.href}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                  minWidth: 0,
                  flex: 1,
                  textDecoration: 'none',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  transition: 'color 0.2s'
                }}
              >
                <item.icon size={20} style={{ marginBottom: 4 }} />
                <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 500, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </Typography>
              </Box>
            );
          })}
      </Paper>

      {user && (
        <PasskeySetup
          isOpen={showPasskeySetup}
          onClose={() => setShowPasskeySetup(false)}
          userId={user.$id}
          isEnabled={false}
          onSuccess={() => {
            setShowPasskeySetup(false);
            refresh();
          }}
          trustUnlocked={true}
        />
      )}
    </Box>
  );
}
