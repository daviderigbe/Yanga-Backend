-- CreateTable
CREATE TABLE "WsToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WsToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WsToken_token_key" ON "WsToken"("token");

-- CreateIndex
CREATE INDEX "WsToken_userId_idx" ON "WsToken"("userId");

-- CreateIndex
CREATE INDEX "WsToken_token_idx" ON "WsToken"("token");

-- AddForeignKey
ALTER TABLE "WsToken" ADD CONSTRAINT "WsToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
