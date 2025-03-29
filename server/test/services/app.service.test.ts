import * as grpc from "@grpc/grpc-js";
import { Effect } from "effect";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as WebSocket from "ws";
import { createAppService } from "../../src/services/app.service";
import { ServerServiceInterface } from "../../src/services/server.service";

describe("AppService", () => {
  // 모의 서버 인스턴스 생성
  const mockGrpcServer = { on: vi.fn() } as unknown as grpc.Server;
  const mockWebSocketServer = { on: vi.fn() } as unknown as WebSocket.Server;
  const mockExpressApp = { on: vi.fn() } as unknown as express.Application;

  // 모의 ServerService 생성
  const mockServerService: ServerServiceInterface = {
    startGrpcServer: vi.fn(() => Effect.succeed(mockGrpcServer)),
    startWebSocketServer: vi.fn(() => Effect.succeed(mockWebSocketServer)),
    startRestServer: vi.fn(() => Effect.succeed(mockExpressApp)),
  };

  // 콘솔 로그를 스파이하기 위한 설정
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 콘솔 로그 모킹
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // process.on 모킹
    vi.spyOn(process, "on").mockImplementation((event, handler) => {
      return process;
    });
  });

  afterEach(() => {
    // 모킹 초기화
    vi.clearAllMocks();
  });

  describe("start", () => {
    it("모든 서버를 시작해야 함", async () => {
      const appService = createAppService(mockServerService);

      await Effect.runPromise(appService.start);

      // 각 서버의 시작 메서드가 호출되었는지 확인
      expect(mockServerService.startGrpcServer).toHaveBeenCalledTimes(1);
      expect(mockServerService.startWebSocketServer).toHaveBeenCalledTimes(1);
      expect(mockServerService.startRestServer).toHaveBeenCalledTimes(1);

      // 성공 메시지가 로깅되었는지 확인
      expect(consoleLogSpy).toHaveBeenCalledWith("모든 서버가 실행 중입니다");

      // 종료 핸들러가 설정되었는지 확인
      expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    });
  });

  describe("stop", () => {
    it("애플리케이션을 종료 메서드가 존재해야 함", () => {
      const appService = createAppService(mockServerService);

      // stop 메서드가 있는지만 확인
      expect(appService).toHaveProperty("stop");
    });
  });
});
