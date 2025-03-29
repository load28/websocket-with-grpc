import { Effect, pipe } from "effect";
import { createProtoService } from "./services/proto.service";
import { createServerService } from "./services/server.service";
import { createUserRepository } from "./services/user.repository";

console.log("애플리케이션 시작 중...");

// 의존성을 직접 생성하여 기존 타입 문제 우회
const protoService = createProtoService();
const userRepository = createUserRepository();
const serverService = createServerService(protoService, userRepository);

// 서버 시작 함수 - Effect.tryCatch를 사용한 함수형 접근 방식
const startServers = pipe(
  // 모든 서버를 병렬로 시작
  Effect.all([
    serverService.startGrpcServer(),
    serverService.startWebSocketServer(),
    serverService.startRestServer(),
  ]),

  // 결과 로깅 및 처리
  Effect.flatMap(([grpcServer, webSocketServer, restServer]) =>
    Effect.sync(() => {
      console.log("모든 서버가 실행 중입니다");

      // 종료 핸들러 설정
      process.on("SIGINT", () => {
        console.log("서버 종료 중...");
        process.exit(0);
      });

      return { grpcServer, webSocketServer, restServer };
    })
  ),

  // 오류 처리
  Effect.catchAll((error) =>
    Effect.sync(() => {
      console.error("서버 시작 실패:", error);
      process.exit(1);
    })
  )
);

// Effect 실행
Effect.runPromise(startServers)
  .then(() => {
    console.log(
      "서버가 성공적으로 시작되었습니다. 종료하려면 Ctrl+C를 누르세요."
    );
  })
  .catch((error) => {
    console.error("예기치 않은 오류 발생:", error);
    process.exit(1);
  });
