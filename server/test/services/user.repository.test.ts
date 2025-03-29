import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createUserRepository } from "../../src/services/user.repository";

describe("UserRepository", () => {
  const userRepository = createUserRepository();

  describe("getUsers", () => {
    it("모든 사용자를 반환해야 함", async () => {
      const result = await Effect.runPromise(userRepository.getUsers());

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("email");
    });
  });

  describe("getUserById", () => {
    it("존재하는 ID로 사용자를 찾아야 함", async () => {
      // 첫 번째로 모든 사용자를 가져옴
      const users = await Effect.runPromise(userRepository.getUsers());
      const firstUser = users[0];

      // 첫 번째 사용자의 ID로 사용자 조회
      const user = await Effect.runPromise(
        userRepository.getUserById(firstUser.id)
      );

      expect(user).toBeDefined();
      expect(user.id).toBe(firstUser.id);
      expect(user.name).toBe(firstUser.name);
      expect(user.email).toBe(firstUser.email);
    });

    it("존재하지 않는 ID로 조회하면 에러를 반환해야 함", async () => {
      const nonExistentId = "non-existent-id";

      await expect(
        Effect.runPromise(userRepository.getUserById(nonExistentId))
      ).rejects.toThrow(`사용자 ID ${nonExistentId}를 찾을 수 없습니다`);
    });
  });

  describe("generateTestUsers", () => {
    it("요청한 수만큼의 테스트 사용자를 생성해야 함", async () => {
      const count = 5;
      const users = await Effect.runPromise(
        userRepository.generateTestUsers(count)
      );

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(count);

      // 모든 사용자가 필요한 속성을 가지고 있는지 확인
      users.forEach((user, index) => {
        expect(user).toHaveProperty("id", `user${index + 1}`);
        expect(user).toHaveProperty("name", `사용자 ${index + 1}`);
        expect(user).toHaveProperty("email", `user${index + 1}@example.com`);
        expect(user).toHaveProperty("age");
        expect(user).toHaveProperty("role");
      });
    });
  });
});
