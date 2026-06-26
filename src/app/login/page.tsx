import Image from "next/image"

import { LanguageSwitcher } from "@/components/language-switcher"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Image
          src="https://astraflow.ucloud.cn/static/logo-lg-zh.png"
          alt="Astraflow"
          width={180}
          height={40}
          priority
          unoptimized
          className="h-10 w-auto self-center"
        />
        <LoginForm />
      </div>
    </main>
  )
}
