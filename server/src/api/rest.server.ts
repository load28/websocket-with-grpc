import { Effect, pipe } from "effect";
import express from "express";
import { formatSizeComparison } from "../infrastructure/utils";
import { ProtoServiceInterface } from "../services/proto.service";
import { UserRepositoryInterface } from "../services/user.repository";

// 상수 정의
export const REST_PORT = 3001;

// REST 서버 구현
export const createRestServer = (
  protoService: ProtoServiceInterface,
  userRepository: UserRepositoryInterface
) =>
  Effect.gen(function* (_) {
    const app = express();
    app.use(express.json());

    // CORS 설정
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      next();
    });

    // 응답 크기 로깅 미들웨어
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

    // 단일 사용자 조회 엔드포인트
    app.get("/api/users/:id", async (req, res) => {
      const userId = req.params.id;

      pipe(
        // 1. 사용자 조회
        userRepository.getUserById(userId),
        // 2. 바이너리 변환과 응답
        Effect.flatMap((user) =>
          pipe(
            // JSON 크기 계산
            Effect.sync(() => Buffer.byteLength(JSON.stringify(user))),
            // 바이너리 변환 및 응답
            Effect.flatMap((jsonSize) =>
              pipe(
                protoService.serializeMessage(user, "User"),
                // 성공 시 처리
                Effect.map((binaryData) => {
                  const binarySize = binaryData.length;
                  console.log(
                    formatSizeComparison("단일 사용자", jsonSize, binarySize)
                  );
                  return user;
                }),
                // 바이너리 변환 실패 시 원본 데이터 사용
                Effect.catchAll((error) => {
                  console.error("바이너리 변환 실패:", error);
                  return Effect.succeed(user);
                })
              )
            )
          )
        ),
        // 3. 최종 응답 처리
        Effect.match({
          onSuccess: (user) => res.json(user),
          onFailure: (error) => res.status(404).json({ error: error.message }),
        }),
        // 4. 실행
        Effect.runPromise
      ).catch((error) => {
        console.error("사용자 조회 중 예기치 않은 오류:", error);
        res.status(500).json({ error: "서버 내부 오류" });
      });
    });

    // 모든 사용자 조회 엔드포인트
    app.get("/api/users", async (req, res) => {
      pipe(
        // 1. 모든 사용자 조회
        userRepository.getUsers(),
        // 2. 사용자 목록 구성 및 변환
        Effect.flatMap((users) => {
          const userList = { users };
          const jsonSize = Buffer.byteLength(JSON.stringify(userList));

          return pipe(
            // 바이너리 변환
            protoService.serializeMessage(userList, "UserList"),
            // 성공 시 처리
            Effect.map((binaryData) => {
              const binarySize = binaryData.length;
              console.log(
                formatSizeComparison("사용자 목록", jsonSize, binarySize)
              );
              return userList;
            }),
            // 변환 실패 시 원본 데이터 사용
            Effect.catchAll((error) => {
              console.error("바이너리 변환 실패:", error);
              return Effect.succeed(userList);
            })
          );
        }),
        // 3. 최종 응답
        Effect.match({
          onSuccess: (userList) => res.json(userList),
          onFailure: (error) =>
            res.status(500).json({
              error: "사용자 목록을 가져오는 중 오류 발생",
            }),
        }),
        // 4. 실행
        Effect.runPromise
      ).catch((error) => {
        console.error("사용자 목록 조회 중 예기치 않은 오류:", error);
        res.status(500).json({ error: "서버 내부 오류" });
      });
    });

    // 데이터 비교 엔드포인트
    app.get("/api/data-comparison", async (req, res) => {
      const sizes = [10, 50, 100, 500, 1000];

      pipe(
        // 1. 각 크기별 데이터 생성 및 비교 실행
        Effect.forEach(sizes, (size) =>
          pipe(
            // 테스트 사용자 생성
            userRepository.generateTestUsers(size),
            Effect.flatMap((testUsers) => {
              const userList = { users: testUsers };
              const jsonData = JSON.stringify(userList);
              const jsonSize = Buffer.byteLength(jsonData);

              return pipe(
                // 바이너리 변환
                protoService.serializeMessage(userList, "UserList"),
                // 결과 계산
                Effect.map((binaryData) => {
                  const binarySize = binaryData.length;
                  const savingsPercent = (
                    ((jsonSize - binarySize) / jsonSize) *
                    100
                  ).toFixed(2);

                  return {
                    userCount: size,
                    jsonSize,
                    binarySize,
                    savings: jsonSize - binarySize,
                    savingsPercent,
                  };
                }),
                // 변환 실패 처리
                Effect.catchAll((error) => {
                  console.error("바이너리 변환 실패:", error);
                  return Effect.fail(error);
                })
              );
            }),
            // 오류 발생 시 해당 크기는 건너뛰기
            Effect.catchAll((error) => {
              console.error(`${size}명의 사용자 데이터 처리 중 오류:`, error);
              return Effect.succeed(null);
            })
          )
        ),
        // 2. null 값 필터링
        Effect.map((results) => results.filter(Boolean)),
        // 3. 최종 응답
        Effect.match({
          onSuccess: (results) => res.json(results),
          onFailure: (error) =>
            res.status(500).json({
              error: "데이터 비교 중 오류 발생",
            }),
        }),
        // 4. 실행
        Effect.runPromise
      ).catch((error) => {
        console.error("데이터 비교 중 예기치 않은 오류:", error);
        res.status(500).json({ error: "서버 내부 오류" });
      });
    });

    const server = app.listen(REST_PORT, () => {
      console.log(`REST API 서버가 포트 ${REST_PORT}에서 실행 중입니다`);
    });

    return app;
  });
