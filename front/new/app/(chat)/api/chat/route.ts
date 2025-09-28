import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  "http://localhost:8000";

const BACKEND_API_AUTH_HEADER =
  process.env.BACKEND_API_AUTH_HEADER ?? "";

const BACKEND_API_AUTH_VALUE = process.env.BACKEND_API_AUTH_VALUE ?? "";

function extractTextFromMessage(message: ChatMessage) {
  const textParts = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text?.trim())
    .filter((text): text is string => Boolean(text));

  return textParts.join("\n").trim();
}

function buildSSEStream(answer: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const messageId = generateUUID();

      send({ type: "start-step" });
      send({ type: "text-start", id: messageId });
      send({ type: "text-delta", id: messageId, delta: answer });
      send({ type: "text-end", id: messageId });
      send({ type: "finish-step" });
      send({ type: "finish" });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export function getStreamContext() {
  return null;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const messageText = extractTextFromMessage(message);

    if (!messageText) {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const backendEndpoint = new URL(
      "/api/v1/ai-agent/chat",
      BACKEND_API_BASE_URL
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (BACKEND_API_AUTH_HEADER && BACKEND_API_AUTH_VALUE) {
      headers[BACKEND_API_AUTH_HEADER] = BACKEND_API_AUTH_VALUE;
    }

    const backendResponse = await fetch(backendEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: messageText,
        conversation_id: id,
        include_memory: true,
      }),
    });

    if (!backendResponse.ok) {
      const errorPayload = await backendResponse
        .json()
        .catch(() => ({ detail: backendResponse.statusText }));

      console.error("Backend chat request failed", {
        status: backendResponse.status,
        error: errorPayload,
      });

      return new ChatSDKError("offline:chat").toResponse();
    }

    const backendPayload = await backendResponse.json();
    const answer = String(backendPayload?.response ?? "").trim();

    if (!answer) {
      return new ChatSDKError("offline:chat").toResponse();
    }

    const assistantMessageId = generateUUID();

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: assistantMessageId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: answer,
            },
          ],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const stream = buildSSEStream(answer);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache, no-transform",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
