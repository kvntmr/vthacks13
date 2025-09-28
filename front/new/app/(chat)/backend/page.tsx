import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BackendChat } from "@/components/backend-chat";
import { auth } from "../(auth)/auth";

export default async function BackendChatPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  return (
    <div className="container mx-auto p-4 h-screen">
      <BackendChat className="h-full" />
    </div>
  );
}
