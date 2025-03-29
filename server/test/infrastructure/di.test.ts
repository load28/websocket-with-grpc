import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  AppServiceLive,
  ProtoServiceLive,
  ServerServiceLive,
  UserRepositoryLive,
} from "../../src/infrastructure/di";
import { AppService } from "../../src/services/app.service";
import { ProtoService } from "../../src/services/proto.service";
import { ServerService } from "../../src/services/server.service";
import { UserRepository } from "../../src/services/user.repository";

describe("의존성 주입 레이어", () => {
  describe("ProtoServiceLive", () => {
    it("ProtoService 인스턴스를 제공해야 함", async () => {
      // Effect 생성 및 실행
      const result = await Effect.runPromise(
        Effect.provide(
          Effect.map(ProtoService, (service) => service),
          ProtoServiceLive
        )
      );

      // ProtoService 인스턴스가 제공되었는지 확인
      expect(result).toBeDefined();
      expect(typeof result.getProtoDefinition).toBe("function");
      expect(typeof result.serializeMessage).toBe("function");
    });
  });

  describe("UserRepositoryLive", () => {
    it("UserRepository 인스턴스를 제공해야 함", async () => {
      // Effect 생성 및 실행
      const result = await Effect.runPromise(
        Effect.provide(
          Effect.map(UserRepository, (service) => service),
          UserRepositoryLive
        )
      );

      // UserRepository 인스턴스가 제공되었는지 확인
      expect(result).toBeDefined();
      expect(typeof result.getUsers).toBe("function");
      expect(typeof result.getUserById).toBe("function");
      expect(typeof result.generateTestUsers).toBe("function");
    });
  });

  describe("ServerServiceLive", () => {
    it("ServerService 인스턴스를 제공해야 함", async () => {
      // Effect 생성 및 실행
      const result = await Effect.runPromise(
        Effect.provide(
          Effect.map(ServerService, (service) => service),
          ServerServiceLive
        )
      );

      // ServerService 인스턴스가 제공되었는지 확인
      expect(result).toBeDefined();
      expect(typeof result.startGrpcServer).toBe("function");
      expect(typeof result.startWebSocketServer).toBe("function");
      expect(typeof result.startRestServer).toBe("function");
    });
  });

  describe("AppServiceLive", () => {
    it("AppService 인스턴스를 제공해야 함", async () => {
      // Effect 생성 및 실행
      const result = await Effect.runPromise(
        Effect.provide(
          Effect.map(AppService, (service) => service),
          AppServiceLive
        )
      );

      // AppService 인스턴스가 제공되었는지 확인
      expect(result).toBeDefined();
      expect(result).toHaveProperty("start");
      expect(result).toHaveProperty("stop");
    });
  });
});
