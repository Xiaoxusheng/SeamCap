import { get } from './client'
import type { DashboardData } from './types'

// 工作台数据有两个消费方：布局里的「新询价」徽标 + 仪表盘页。
// 进入后台时两者会同时请求，之前每次路由切换徽标还会再请求一次。
// 这里做「10 秒 TTL + 并发合并」：同一次进入只打一次接口，手动刷新仍能拿最新值。
const TTL_MS = 10_000

let cached: { at: number; data: DashboardData } | null = null
let inflight: Promise<DashboardData> | null = null

export function fetchDashboard(force = false): Promise<DashboardData> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return Promise.resolve(cached.data)
  }
  if (!inflight) {
    inflight = get<DashboardData>('/admin/dashboard')
      .then(({ data }) => {
        cached = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

// 状态变更等写操作后调用，保证下一次读取拿到新数据。
export function invalidateDashboard(): void {
  cached = null
}
