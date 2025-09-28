import { ChatDashboard } from "@/components/compliance/chat-dashboard";

export default function Page() {
  return (
    <main className="min-h-screen bg-muted/10 antialiased text-foreground">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Material+Icons" />
      <ChatDashboard />
    </main>
  );
}
