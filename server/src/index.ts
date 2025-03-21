import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import express from "express";
import * as path from "path";
import * as protobuf from "protobufjs";
import * as WebSocket from "ws";

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

const PROTO_PATH = path.resolve(__dirname, "../../proto/user.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition);

let protoRoot: protobuf.Root | null = null;

try {
  protoRoot = protobuf.loadSync(PROTO_PATH);
  console.log("Protobuf 정의가 성공적으로 로드되었습니다.");
} catch (error) {
  console.error("Protobuf 정의 로드 중 오류:", error);
}

function serializeMessage(message: any, messageType: string): Buffer {
  try {
    if (!protoRoot) {
      console.warn("Protobuf 정의가 로드되지 않았습니다. JSON으로 폴백합니다.");
      return Buffer.from(JSON.stringify(message), "utf8");
    }

    const MessageType = protoRoot.lookupType("user." + messageType);

    const verificationError = MessageType.verify(message);
    if (verificationError) {
      console.warn(
        `메시지 검증 오류 (${messageType}): ${verificationError}. JSON으로 폴백합니다.`
      );
      return Buffer.from(JSON.stringify(message), "utf8");
    }

    const protoMessage = MessageType.create(message);
    const encodedMessage = MessageType.encode(protoMessage).finish();

    return Buffer.from(encodedMessage);
  } catch (error) {
    console.error(`메시지 직렬화 중 오류 (${messageType}):`, error);
    return Buffer.from(JSON.stringify(message), "utf8");
  }
}

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

function startRestServer() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });

  app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
      const contentLength = Buffer.byteLength(
        body instanceof Buffer ? body : JSON.stringify(body)
      );
      console.log(`REST 응답 크기: ${contentLength} 바이트`);
      return originalSend.call(this, body);
    };
    next();
  });

  app.get("/api/users/:id", async (req, res) => {
    const userId = req.params.id;
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res
        .status(404)
        .json({ error: `사용자 ID ${userId}를 찾을 수 없습니다` });
    }

    const jsonSize = Buffer.byteLength(JSON.stringify(user));

    const binarySize = serializeMessage(user, "User").length;

    console.log(
      `데이터 크기 비교 - 단일 사용자:\n- JSON: ${jsonSize} 바이트\n- Protocol Buffers: ${binarySize} 바이트\n- 절감율: ${(
        ((jsonSize - binarySize) / jsonSize) *
        100
      ).toFixed(2)}%`
    );

    res.json(user);
  });

  app.get("/api/users", (req, res) => {
    const userList = { users };

    const jsonSize = Buffer.byteLength(JSON.stringify(userList));

    const binarySize = serializeMessage(userList, "UserList").length;

    console.log(
      `데이터 크기 비교 - 사용자 목록:\n- JSON: ${jsonSize} 바이트\n- Protocol Buffers: ${binarySize} 바이트\n- 절감율: ${(
        ((jsonSize - binarySize) / jsonSize) *
        100
      ).toFixed(2)}%`
    );

    res.json(userList);
  });

  app.get("/api/data-comparison", (req, res) => {
    const sizes = [10, 50, 100, 500, 1000];
    const results = [];

    for (const size of sizes) {
      const testUsers = generateTestUsers(size);
      const userList = { users: testUsers };

      const jsonData = JSON.stringify(userList);
      const jsonSize = Buffer.byteLength(jsonData);

      const binaryData = serializeMessage(userList, "UserList");
      const binarySize = binaryData.length;

      const savingsPercent = (
        ((jsonSize - binarySize) / jsonSize) *
        100
      ).toFixed(2);

      results.push({
        userCount: size,
        jsonSize,
        binarySize,
        savings: jsonSize - binarySize,
        savingsPercent,
      });
    }

    res.json(results);
  });

  const port = 3001;
  app.listen(port, () => {
    console.log(`REST API 서버가 포트 ${port}에서 실행 중입니다`);
  });

  return app;
}

function generateTestUsers(count: number): User[] {
  const testUsers: User[] = [];

  for (let i = 1; i <= count; i++) {
    testUsers.push({
      id: `user${i}`,
      name: `사용자 ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 50),
      role: i % 5 === 0 ? "관리자" : i % 3 === 0 ? "개발자" : "일반 사용자",
    });
  }

  return testUsers;
}

const userService = {
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

  listUsers: (
    call: grpc.ServerUnaryCall<Empty, UserList>,
    callback: grpc.sendUnaryData<UserList>
  ) => {
    callback(null, { users } as UserList);
  },
};

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
      console.log(`gRPC 서버가 포트 ${port}에서 실행 중입니다`);
    }
  );

  return server;
}

function startWebSocketServer() {
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on("connection", (ws) => {
    console.log("새로운 WebSocket 연결 설정됨");

    ws.on("message", async (message) => {
      try {
        const requestBuffer = Buffer.from(message as Buffer);
        const requestType = requestBuffer.readUInt8(0);
        const requestData = requestBuffer.subarray(1); // 나머지는 요청 데이터

        const client = new (proto as any).user.UserService(
          "localhost:50051",
          grpc.credentials.createInsecure()
        );

        let response: Buffer;

        switch (requestType) {
          case 1:
            const userId = requestData.toString("utf8");
            console.log(`사용자 ID(${userId}) 정보 요청 수신`);

            const user = await getUserById(client, userId);

            const userBinary = serializeMessage(user, "User");

            response = Buffer.concat([Buffer.from([1]), userBinary]);

            console.log(
              `사용자 응답 크기: 타입(1바이트) + 데이터(${userBinary.length}바이트) = ${response.length}바이트`
            );

            const userJson = JSON.stringify(user);
            const jsonSize = Buffer.byteLength(userJson);
            console.log(
              `데이터 크기 비교 - 단일 사용자:\n- JSON: ${jsonSize} 바이트\n- Protocol Buffers: ${
                userBinary.length
              } 바이트\n- 절감율: ${(
                ((jsonSize - userBinary.length) / jsonSize) *
                100
              ).toFixed(2)}%`
            );

            break;

          case 2:
            console.log("사용자 목록 요청 수신");

            const userList = await listAllUsers(client);

            const userListBinary = serializeMessage(userList, "UserList");

            response = Buffer.concat([Buffer.from([2]), userListBinary]);

            console.log(
              `사용자 목록 응답 크기: 타입(1바이트) + 데이터(${userListBinary.length}바이트) = ${response.length}바이트`
            );

            const listJson = JSON.stringify(userList);
            const listJsonSize = Buffer.byteLength(listJson);
            console.log(
              `데이터 크기 비교 - 사용자 목록:\n- JSON: ${listJsonSize} 바이트\n- Protocol Buffers: ${
                userListBinary.length
              } 바이트\n- 절감율: ${(
                ((listJsonSize - userListBinary.length) / listJsonSize) *
                100
              ).toFixed(2)}%`
            );

            break;

          default:
            console.warn(`알 수 없는 요청 타입: ${requestType}`);
            response = Buffer.from([0, 0]);
            break;
        }

        ws.send(response);
      } catch (error) {
        console.error("메시지 처리 중 오류 발생:", error);
        const errorResponse = Buffer.concat([
          Buffer.from([255]),
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

const grpcServer = startGrpcServer();
const webSocketServer = startWebSocketServer();
const restServer = startRestServer();

process.on("SIGINT", () => {
  console.log("서버 종료 중...");
  grpcServer.tryShutdown(() => {
    webSocketServer.close();
    console.log("서버가 종료되었습니다");
    process.exit(0);
  });
});
