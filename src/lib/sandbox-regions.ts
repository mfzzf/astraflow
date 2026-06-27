export const DEFAULT_SANDBOX_REGION = "cn-wlcb"
export const SANDBOX_REGIONS = [DEFAULT_SANDBOX_REGION, "us-ca"] as const

export function isSandboxRegion(region: string) {
  return SANDBOX_REGIONS.some((item) => item === region)
}
