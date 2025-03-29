import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { Effect, pipe } from "effect";
import { Empty, User, UserList, UserRequest } from "../domain/user.model";
import { GRPC_PORT } from "../infrastructure/grpc.client";
import { PROTO_PATH } from "../services/proto.service";
import { UserRepositoryInterface } from "../services/user.repository";

// gRPC 서버 구현
export const createGrpcServer = (userRepository: UserRepositoryInterface) =>
  Effect.gen(function* (_) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition);

    const userService = {
      getUser: (
        call: grpc.ServerUnaryCall<UserRequest, User>,
        callback: grpc.sendUnaryData<User>
      ) => {
        const request = call.request as UserRequest;

        pipe(
          // 1. 사용자 ID 추출
          request.id,
          // 2. ID로 사용자 조회
          userRepository.getUserById,
          // 3. 콜백 처리
          Effect.match({
            onSuccess: (user) => callback(null, user),
            onFailure: (error) =>
              callback({
                code: grpc.status.NOT_FOUND,
                message: error.message,
              }),
          }),
          // 4. 실행
          Effect.runPromise
        );
      },

      listUsers: (
        call: grpc.ServerUnaryCall<Empty, UserList>,
        callback: grpc.sendUnaryData<UserList>
      ) => {
        pipe(
          // 1. 모든 사용자 조회
          userRepository.getUsers(),
          // 2. 응답 형식으로 변환
          Effect.map((users) => ({ users } as UserList)),
          // 3. 콜백 처리 - 오류가 발생하지 않으므로 간소화
          Effect.map((userList) => callback(null, userList)),
          // 4. 실행
          Effect.runPromise
        ).catch((error) => {
          // 예상치 못한 오류 처리
          console.error("사용자 목록 조회 중 예기치 않은 오류:", error);
          callback({
            code: grpc.status.INTERNAL,
            message: "내부 서버 오류",
          });
        });
      },
    };

    const server = new grpc.Server();
    server.addService((proto as any).user.UserService.service, userService);

    yield* _(
      Effect.async<number, Error>((resume) => {
        server.bindAsync(
          `0.0.0.0:${GRPC_PORT}`,
          grpc.ServerCredentials.createInsecure(),
          (err, port) => {
            if (err) {
              resume(Effect.fail(new Error(`gRPC 서버 시작 실패: ${err}`)));
            } else {
              console.log(`gRPC 서버가 포트 ${port}에서 실행 중입니다`);
              resume(Effect.succeed(port));
            }
          }
        );
      })
    );

    return server;
  });
