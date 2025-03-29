import { Context, Effect } from "effect";
import { ServerServiceInterface } from "./server.service";

// 앱 서비스 인터페이스
export interface AppServiceInterface {
  start: Effect.Effect<void, Error>;
  stop: Effect.Effect<void, never>;
}

// 앱 서비스 태그
export class AppService extends Context.Tag("AppService")<
  AppService,
  AppServiceInterface
>() {}

// 앱 서비스 레이어
export const createAppService = (
  serverService: ServerServiceInterface
): AppServiceInterface => {
  return {
    start: Effect.gen(function* (_) {
      // 동시에 모든 서버 시작하기
      const [grpcServer, webSocketServer, restServer] = yield* _(
        Effect.all([
          serverService.startGrpcServer(),
          serverService.startWebSocketServer(),
          serverService.startRestServer(),
        ])
      );

      console.log("모든 서버가 실행 중입니다");

      // 종료 핸들러 설정
      process.on("SIGINT", () => {
        console.log("서버 종료 중...");
        process.exit(0);
      });
    }),

    stop: Effect.succeed(() => {
      console.log("모든 서버가 종료되었습니다");
    }),
  };
};
