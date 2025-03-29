import * as grpc from "@grpc/grpc-js";
import { Effect } from "effect";
import express from "express";
import * as protobuf from "protobufjs";
import { describe, expect, it, vi } from "vitest";
import * as WebSocket from "ws";
import { User } from "../../src/domain/user.model";
import { ProtoServiceInterface } from "../../src/services/proto.service";
import { createServerService } from "../../src/services/server.service";
import { UserRepositoryInterface } from "../../src/services/user.repository";

// 모의 서비스 및 함수 생성
const mockGrpcServer = {
  bindAsync: vi.fn((url, creds, callback) => {
    callback(null, 50051);
  }),
  start: vi.fn(),
} as unknown as grpc.Server;

const mockExpressApp = {
  listen: vi.fn((port, callback) => {
    callback();
    return { on: vi.fn() };
  }),
  use: vi.fn(),
  get: vi.fn(),
} as unknown as express.Application;

const mockWebSocketServer = {
  on: vi.fn(),
} as unknown as WebSocket.Server;

// gRPC 서버 생성 모킹
vi.mock("../../src/api/grpc.server", () => ({
  createGrpcServer: () => Effect.succeed(mockGrpcServer),
}));

// REST 서버 생성 모킹
vi.mock("../../src/api/rest.server", () => ({
  createRestServer: () => Effect.succeed(mockExpressApp),
}));

// WebSocket 서버 생성 모킹
vi.mock("../../src/api/websocket.server", () => ({
  createWebSocketServer: () => Effect.succeed(mockWebSocketServer),
}));

describe("ServerService", () => {
  // 모의 서비스 생성
  const mockProtoService: ProtoServiceInterface = {
    getProtoDefinition: vi.fn(() =>
      Effect.succeed({
        lookupType: vi.fn(),
      } as unknown as protobuf.Root)
    ),
    serializeMessage: vi.fn((message) =>
      Effect.succeed(Buffer.from(JSON.stringify(message)))
    ),
  };

  const mockUserRepository: UserRepositoryInterface = {
    getUsers: vi.fn(() => Effect.succeed([])),
    getUserById: vi.fn((id) =>
      Effect.succeed({
        id,
        name: "Test User",
        email: "test@example.com",
        age: 30,
        role: "Tester",
      } as User)
    ),
    generateTestUsers: vi.fn((count) =>
      Effect.succeed(
        Array(count)
          .fill(0)
          .map((_, i) => ({
            id: `test-${i}`,
            name: `Test User ${i}`,
            email: `test${i}@example.com`,
            age: 30,
            role: "Tester",
          }))
      )
    ),
  };

  // 테스트 대상 서비스 생성
  const serverService = createServerService(
    mockProtoService,
    mockUserRepository
  );

  describe("startGrpcServer", () => {
    it("gRPC 서버를 시작해야 함", async () => {
      const server = await Effect.runPromise(serverService.startGrpcServer());

      expect(server).toBe(mockGrpcServer);
    });
  });

  describe("startWebSocketServer", () => {
    it("WebSocket 서버를 시작해야 함", async () => {
      const server = await Effect.runPromise(
        serverService.startWebSocketServer()
      );

      expect(server).toBe(mockWebSocketServer);
    });
  });

  describe("startRestServer", () => {
    it("REST 서버를 시작해야 함", async () => {
      const app = await Effect.runPromise(serverService.startRestServer());

      expect(app).toBe(mockExpressApp);
    });
  });
});
