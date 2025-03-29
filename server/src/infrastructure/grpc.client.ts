import * as grpc from "@grpc/grpc-js";
import { pipe } from "effect";
import { Empty, User, UserList } from "../domain/user.model";

// 상수 정의
export const GRPC_PORT = 50051;

// gRPC 클라이언트 함수 구현
export const createGrpcClient = (proto: any) => ({
  getUserById: (userId: string): Promise<User> =>
    pipe(
      userId,
      // 클라이언트 생성 및 요청 보내기
      (id) =>
        new Promise<User>((resolve, reject) => {
          const client = new (proto as any).user.UserService(
            `localhost:${GRPC_PORT}`,
            grpc.credentials.createInsecure()
          );

          client.getUser({ id }, (err: Error | null, response: User) => {
            if (err) {
              reject(err);
            } else {
              resolve(response);
            }
          });
        })
    ),

  listAllUsers: (): Promise<UserList> =>
    new Promise((resolve, reject) => {
      const client = new (proto as any).user.UserService(
        `localhost:${GRPC_PORT}`,
        grpc.credentials.createInsecure()
      );

      client.listUsers({} as Empty, (err: Error | null, response: UserList) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    }),
});
