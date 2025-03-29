import * as grpc from "@grpc/grpc-js";
import { Context, Effect } from "effect";
import express from "express";
import * as WebSocket from "ws";
import { createGrpcServer } from "../api/grpc.server";
import { createRestServer } from "../api/rest.server";
import { createWebSocketServer } from "../api/websocket.server";
import { ProtoServiceInterface } from "./proto.service";
import { UserRepositoryInterface } from "./user.repository";

// 서버 서비스 인터페이스
export interface ServerServiceInterface {
  startRestServer(): Effect.Effect<express.Application, Error>;
  startGrpcServer(): Effect.Effect<grpc.Server, Error>;
  startWebSocketServer(): Effect.Effect<WebSocket.Server, Error>;
}

// 서버 서비스 태그
export class ServerService extends Context.Tag("ServerService")<
  ServerService,
  ServerServiceInterface
>() {}

// 서버 서비스 구현
export const createServerService = (
  protoService: ProtoServiceInterface,
  userRepository: UserRepositoryInterface
): ServerServiceInterface => {
  return {
    startRestServer: () => createRestServer(protoService, userRepository),
    startGrpcServer: () => createGrpcServer(userRepository),
    startWebSocketServer: () => createWebSocketServer(protoService),
  };
};
