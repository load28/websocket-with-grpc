import { Layer } from "effect";
import { AppService, createAppService } from "../services/app.service";
import { ProtoService, createProtoService } from "../services/proto.service";
import { ServerService, createServerService } from "../services/server.service";
import {
  UserRepository,
  createUserRepository,
} from "../services/user.repository";

// 프로토 서비스 레이어
export const ProtoServiceLive = Layer.succeed(
  ProtoService,
  createProtoService()
);

// 사용자 저장소 레이어
export const UserRepositoryLive = Layer.succeed(
  UserRepository,
  createUserRepository()
);

// 서버 서비스 레이어
export const ServerServiceLive = Layer.succeed(
  ServerService,
  createServerService(createProtoService(), createUserRepository())
);

// 앱 서비스 레이어
export const AppServiceLive = Layer.succeed(
  AppService,
  createAppService(
    createServerService(createProtoService(), createUserRepository())
  )
);
