import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import * as WebSocket from "ws";

// 사용자 및 응답 타입 정의
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: string;
}

interface UserList {
  users: User[];
}

interface UserRequest {
  id: string;
}

interface Empty {}

// 프로토 파일 로드
const PROTO_PATH = path.resolve(__dirname, "../../proto/user.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);

// 샘플 사용자 데이터
const users: User[] = [
  {
    id: "1",
    name: "김철수",
    email: "kim@example.com",
    age: 30,
    role: "관리자",
  },
  {
    id: "2",
    name: "이영희",
    email: "lee@example.com",
    age: 28,
    role: "개발자",
  },
  {
    id: "3",
    name: "박민준",
    email: "park@example.com",
    age: 35,
    role: "디자이너",
  },
];

// gRPC 서비스 구현
const userService = {
  // 특정 사용자 조회
  getUser: (
    call: grpc.ServerUnaryCall<UserRequest, User>,
    callback: grpc.sendUnaryData<User>
  ) => {
    const request = call.request as UserRequest;
    const user = users.find((u) => u.id === request.id);

    if (user) {
      callback(null, user);
    } else {
      callback({
        code: grpc.status.NOT_FOUND,
        message: `사용자 ID ${request.id}를 찾을 수 없습니다`,
      });
    }
  },

  // 모든 사용자 목록 조회
  listUsers: (
    call: grpc.ServerUnaryCall<Empty, UserList>,
    callback: grpc.sendUnaryData<UserList>
  ) => {
    callback(null, { users } as UserList);
  },
};

// gRPC 서버 설정 및 시작
function startGrpcServer() {
  const server = new grpc.Server();
  server.addService((proto as any).user.UserService.service, userService);

  const port = 50051;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("gRPC 서버 시작 실패:", err);
        return;
      }
      server.start();
      console.log(`gRPC 서버가 포트 ${port}에서 실행 중입니다`);
    }
  );

  return server;
}

// WebSocket 서버 설정
function startWebSocketServer() {
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on("connection", (ws) => {
    console.log("새로운 WebSocket 연결 설정됨");

    ws.on("message", async (message) => {
      try {
        // 클라이언트에서 받은 바이너리 메시지 파싱
        const requestBuffer = Buffer.from(message as Buffer);
        const requestType = requestBuffer.readUInt8(0); // 첫 바이트는 요청 타입
        const requestData = requestBuffer.subarray(1); // 나머지는 요청 데이터

        // gRPC 클라이언트 생성
        const client = new (proto as any).user.UserService(
          "localhost:50051",
          grpc.credentials.createInsecure()
        );

        let response: Buffer;

        switch (requestType) {
          case 1: // GetUser 요청
            const userId = requestData.toString("utf8");
            const user = await getUserById(client, userId);

            // 응답 바이너리 생성: 타입(1) + 사용자 데이터
            const userBuffer = Buffer.from(JSON.stringify(user), "utf8");
            response = Buffer.concat([
              Buffer.from([1]), // 응답 타입 1 (GetUser 응답)
              userBuffer,
            ]);
            break;

          case 2: // ListUsers 요청
            const userList = await listAllUsers(client);

            // 응답 바이너리 생성: 타입(2) + 사용자 목록 데이터
            const usersBuffer = Buffer.from(JSON.stringify(userList), "utf8");
            response = Buffer.concat([
              Buffer.from([2]), // 응답 타입 2 (ListUsers 응답)
              usersBuffer,
            ]);
            break;

          default:
            // 잘못된 요청 타입
            response = Buffer.from([0, 0]); // 에러 응답
            break;
        }

        // 바이너리 응답 전송
        ws.send(response);
      } catch (error) {
        console.error("메시지 처리 중 오류 발생:", error);
        // 에러 응답 전송
        const errorResponse = Buffer.concat([
          Buffer.from([255]), // 에러 타입
          Buffer.from(JSON.stringify({ error: "요청 처리 실패" })),
        ]);
        ws.send(errorResponse);
      }
    });

    ws.on("close", () => {
      console.log("WebSocket 연결 종료됨");
    });
  });

  console.log("WebSocket 서버가 포트 8080에서 실행 중입니다");
  return wss;
}

// Promise 기반 gRPC 호출 함수들
function getUserById(client: any, userId: string): Promise<User> {
  return new Promise((resolve, reject) => {
    client.getUser({ id: userId }, (err: Error | null, response: User) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

function listAllUsers(client: any): Promise<UserList> {
  return new Promise((resolve, reject) => {
    client.listUsers({} as Empty, (err: Error | null, response: UserList) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

// 서버 시작
const grpcServer = startGrpcServer();
const webSocketServer = startWebSocketServer();

// 종료 핸들러
process.on("SIGINT", () => {
  console.log("서버 종료 중...");
  grpcServer.tryShutdown(() => {
    webSocketServer.close();
    console.log("서버가 종료되었습니다");
    process.exit(0);
  });
});
