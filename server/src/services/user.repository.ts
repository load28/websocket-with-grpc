import { Context, Effect, pipe } from "effect";
import { User } from "../domain/user.model";

// 사용자 저장소 서비스 인터페이스
export interface UserRepositoryInterface {
  getUsers(): Effect.Effect<readonly User[], never>;
  getUserById(id: string): Effect.Effect<User, Error>;
  generateTestUsers(count: number): Effect.Effect<readonly User[], never>;
}

// 사용자 저장소 태그
export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepositoryInterface
>() {}

// 불변 데이터 모델
const mockUsers: readonly User[] = Object.freeze([
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
]);

// 순수 함수형 구현
export const createUserRepository = (): UserRepositoryInterface => ({
  getUsers: () => Effect.succeed(mockUsers),

  getUserById: (id) =>
    pipe(
      Effect.succeed(mockUsers),
      Effect.map((users) => users.find((user) => user.id === id)),
      Effect.flatMap((maybeUser) =>
        maybeUser
          ? Effect.succeed(maybeUser)
          : Effect.fail(new Error(`사용자 ID ${id}를 찾을 수 없습니다`))
      )
    ),

  generateTestUsers: (count) =>
    Effect.succeed(
      Array.from({ length: count }, (_, i) => ({
        id: `user${i + 1}`,
        name: `사용자 ${i + 1}`,
        email: `user${i + 1}@example.com`,
        age: 20 + ((i + 1) % 50),
        role:
          (i + 1) % 5 === 0
            ? "관리자"
            : (i + 1) % 3 === 0
            ? "개발자"
            : "일반 사용자",
      }))
    ),
});
