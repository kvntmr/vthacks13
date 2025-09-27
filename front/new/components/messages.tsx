import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import { memo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { Conversation, ConversationContent } from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
};

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    status,
  });

  useDataStream();

  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch relative flex-1 touch-pan-y overflow-y-scroll bg-muted/5"
      ref={messagesContainerRef}
      style={{ overflowAnchor: "none" }}
    >
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-5 px-4 py-6 md:gap-6 md:px-6">
        <ConversationContent className="flex flex-col gap-5">
          <div className="rounded-3xl border border-border/60 bg-background/95 p-6 shadow-sm">
            <div className="space-y-4">
              {messages.length === 0 && <Greeting />}

              <div className="space-y-4">
                {messages.map((message, index) => (
                  <PreviewMessage
                    chatId={chatId}
                    isLoading={
                      status === "streaming" && messages.length - 1 === index
                    }
                    isReadonly={isReadonly}
                    key={message.id}
                    message={message}
                    regenerate={regenerate}
                    requiresScrollPadding={
                      hasSentMessage && index === messages.length - 1
                    }
                    setMessages={setMessages}
                    vote={
                      votes
                        ? votes.find((vote) => vote.messageId === message.id)
                        : undefined
                    }
                  />
                ))}

                {status === "submitted" &&
                  messages.length > 0 &&
                  messages.at(-1)?.role === "user" &&
                  selectedModelId !== "chat-model-reasoning" && <ThinkingMessage />}
              </div>

              <div
                className="min-h-[24px] min-w-[24px] shrink-0"
                ref={messagesEndRef}
              />
            </div>
          </div>
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <Button
          aria-label="Scroll to bottom"
          className="-translate-x-1/2 absolute bottom-32 left-1/2 z-10 rounded-full border border-border/60 bg-background shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDownIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return false;
});
