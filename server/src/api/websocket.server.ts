import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { Effect, pipe } from "effect";
import * as WebSocket from "ws";
import { createGrpcClient } from "../infrastructure/grpc.client";
import { formatSizeComparison } from "../infrastructure/utils";
import { PROTO_PATH, ProtoServiceInterface } from "../services/proto.service";

// 상수 정의
export const WEBSOCKET_PORT = 8080;

// WebSocket 서버 구현
export const createWebSocketServer = (protoService: ProtoServiceInterface) =>
  Effect.gen(function* (_) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition);
    const grpcClient = createGrpcClient(proto);

    const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

    // 요청 타입에 따른 핸들러 함수
    const requestHandlers = {
      // 단일 사용자 요청 핸들러
      1(data: Buffer): Effect.Effect<Buffer, Error> {
        return pipe(
          // 1. 사용자 ID 추출
          Effect.sync(() => {
            const userId = data.toString("utf8");
            console.log(`사용자 ID(${userId}) 정보 요청 수신`);
            return userId;
          }),

          // 2. 사용자 정보 조회
          Effect.flatMap((userId) =>
            Effect.tryPromise(() => grpcClient.getUserById(userId))
          ),

          // 3. 직렬화 및 응답 구성
          Effect.flatMap((user) =>
            pipe(
              // Protobuf 직렬화
              protoService.serializeMessage(user, "User"),

              // 응답 구성 및 로깅
              Effect.map((userBinary) => {
                const userJson = JSON.stringify(user);
                const jsonSize = Buffer.byteLength(userJson);
                console.log(
                  formatSizeComparison(
                    "단일 사용자",
                    jsonSize,
                    userBinary.length
                  )
                );

                // 응답 구성 (타입 + 데이터)
                return Buffer.concat([Buffer.from([1]), userBinary]);
              })
            )
          )
        );
      },

      // 모든 사용자 요청 핸들러
      2(): Effect.Effect<Buffer, Error> {
        return pipe(
          // 1. 로깅
          Effect.sync(() => {
            console.log("사용자 목록 요청 수신");
          }),

          // 2. 사용자 목록 조회
          Effect.flatMap(() =>
            Effect.tryPromise(() => grpcClient.listAllUsers())
          ),

          // 3. 직렬화 및 응답 구성
          Effect.flatMap((userList) =>
            pipe(
              // Protobuf 직렬화
              protoService.serializeMessage(userList, "UserList"),

              // 응답 구성 및 로깅
              Effect.map((userListBinary) => {
                const listJson = JSON.stringify(userList);
                const listJsonSize = Buffer.byteLength(listJson);
                console.log(
                  formatSizeComparison(
                    "사용자 목록",
                    listJsonSize,
                    userListBinary.length
                  )
                );

                // 응답 구성 (타입 + 데이터)
                return Buffer.concat([Buffer.from([2]), userListBinary]);
              })
            )
          )
        );
      },
    };

    // 에러 응답 생성 함수
    const createErrorResponse = (message: string): Buffer =>
      Buffer.concat([
        Buffer.from([255]),
        Buffer.from(JSON.stringify({ error: message })),
      ]);

    // Effect 기반 메시지 처리 함수
    const handleMessage = (ws: WebSocket.WebSocket, message: Buffer) =>
      pipe(
        // 메시지 파싱
        Effect.try({
          try: () => {
            const requestBuffer = Buffer.from(message);
            const requestType = requestBuffer.readUInt8(0);
            const requestData = requestBuffer.subarray(1);
            return { requestType, requestData };
          },
          catch: (error) => new Error(`메시지 파싱 실패: ${error}`),
        }),

        // 요청 타입에 맞는 핸들러 찾기
        Effect.flatMap(({ requestType, requestData }) =>
          requestType in requestHandlers
            ? pipe(
                Effect.tryPromise(() => {
                  const handler =
                    requestHandlers[
                      requestType as keyof typeof requestHandlers
                    ];
                  return Effect.runPromise(handler(requestData));
                }),
                Effect.map((response) => ({
                  response,
                  success: true,
                  error: null as Error | null,
                })),
                Effect.catchAll((error) => {
                  const errorMessage =
                    error instanceof Error ? error.message : String(error);
                  return Effect.succeed({
                    response: createErrorResponse(
                      `타입 ${requestType} 요청 처리 실패`
                    ),
                    success: false,
                    error: new Error(errorMessage),
                  });
                })
              )
            : Effect.succeed({
                response: Buffer.from([0, 0]),
                success: false,
                error: new Error(`알 수 없는 요청 타입: ${requestType}`),
              })
        ),

        // 응답 전송 및 오류 로깅
        Effect.flatMap(({ response, success, error }) =>
          Effect.sync(() => {
            if (!success && error) {
              console.error(error.message);
            }
            ws.send(response);
          })
        ),

        // 최종 에러 처리
        Effect.catchAll((error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return Effect.sync(() => {
            console.error("메시지 처리 중 오류 발생:", errorMessage);
            ws.send(createErrorResponse("요청 처리 실패"));
          });
        })
      );

    // WebSocket 연결 설정
    wss.on("connection", (ws) => {
      console.log("새로운 WebSocket 연결 설정됨");

      // 메시지 리스너 설정
      ws.on("message", (message) => {
        Effect.runPromise(handleMessage(ws, message as Buffer)).catch(
          (error) => {
            console.error("예기치 않은 오류:", error);
            ws.send(createErrorResponse("심각한 서버 오류"));
          }
        );
      });

      ws.on("close", () => {
        console.log("WebSocket 연결 종료됨");
      });
    });

    console.log(`WebSocket 서버가 포트 ${WEBSOCKET_PORT}에서 실행 중입니다`);
    return wss;
  });
