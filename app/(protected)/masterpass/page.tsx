"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppwrite } from "@/app/appwrite-provider";
import { redirectToAuthIDM } from "@/lib/authUrl";
import { MasterPassModal } from "@/components/overlays/MasterPassModal";

export default function MasterPassPage() {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAppwrite();
  const router = useRouter();
  const searchParams = useSearchParams();
  const closeParam = searchParams.get("close");

  // Redirect to IDM if not logged in
  useEffect(() => {
    if (user === null) {
      redirectToAuthIDM(closeParam === "yes");
    } else if (user) {
      setShowModal(true);
    }
  }, [user, router, closeParam]);

  const handleModalClose = () => {
    // If close=yes parameter was present, redirect back to IDM
    if (closeParam === "yes") {
      redirectToAuthIDM(true);
    } else {
      router.replace("/dashboard");
    }
  };

  return <MasterPassModal isOpen={showModal} onClose={handleModalClose} />;
}
