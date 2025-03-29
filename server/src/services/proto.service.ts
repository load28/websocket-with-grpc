import { Context, Effect } from "effect";
import * as path from "path";
import * as protobuf from "protobufjs";

// 상수 정의
export const PROTO_PATH = path.resolve(__dirname, "../../../proto/user.proto");

// Proto 서비스 인터페이스
export interface ProtoServiceInterface {
  getProtoDefinition(): Effect.Effect<protobuf.Root, Error>;
  serializeMessage(
    message: unknown,
    messageType: string
  ): Effect.Effect<Buffer, Error>;
}

// Proto 서비스 태그
export class ProtoService extends Context.Tag("ProtoService")<
  ProtoService,
  ProtoServiceInterface
>() {}

// Proto 서비스 구현
export const createProtoService = (): ProtoServiceInterface => ({
  getProtoDefinition: () =>
    Effect.try({
      try: () => protobuf.loadSync(PROTO_PATH),
      catch: (error) => new Error(`Protobuf 정의 로드 중 오류: ${error}`),
    }),

  serializeMessage: (message, messageType) =>
    Effect.gen(function* (_) {
      const protoRootResult = yield* _(
        Effect.try({
          try: () => protobuf.loadSync(PROTO_PATH),
          catch: () => null,
        })
      );

      if (!protoRootResult) {
        console.warn(
          "Protobuf 정의가 로드되지 않았습니다. JSON으로 폴백합니다."
        );
        return Buffer.from(JSON.stringify(message), "utf8");
      }

      return yield* _(
        Effect.try({
          try: () => {
            const MessageType = protoRootResult.lookupType(
              "user." + messageType
            );
            const verificationError = MessageType.verify(message);

            if (verificationError) {
              console.warn(
                `메시지 검증 오류 (${messageType}): ${verificationError}. JSON으로 폴백합니다.`
              );
              return Buffer.from(JSON.stringify(message), "utf8");
            }

            const protoMessage = MessageType.create(message);
            const encodedMessage = MessageType.encode(protoMessage).finish();
            return Buffer.from(encodedMessage);
          },
          catch: (error) => {
            console.error(`메시지 직렬화 중 오류 (${messageType}):`, error);
            return Buffer.from(JSON.stringify(message), "utf8");
          },
        })
      );
    }),
});
