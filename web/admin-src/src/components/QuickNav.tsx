import { useEffect, useRef, useState } from 'react'
import { Segmented } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { QUICK_NAV_ITEMS, activeNavKey } from '../navigation'

const MOBILE_QUERY = '(max-width: 768px)'

function useIsMobileNav(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_QUERY).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent): void => setIsMobile(e.matches)
    setIsMobile(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}

// 页面顶部快捷导航：桌面端沿用 antd Segmented 分段控制器；
// 移动端换成横向滚动的胶囊按钮组（窄屏放不下分段控制器，且滚动更符合触屏习惯）。
export default function QuickNav(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeNavKey(location.pathname)
  const isMobile = useIsMobileNav()
  const trackRef = useRef<HTMLDivElement>(null)

  // 切页后让当前胶囊滚到可视区内
  useEffect(() => {
    if (!isMobile) return
    const el = trackRef.current?.querySelector<HTMLElement>('.sc-quicknav__chip.is-active')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active, isMobile])

  if (isMobile) {
    return (
      <div className="sc-quicknav sc-quicknav--chips" role="navigation" aria-label="快捷导航">
        <div className="sc-quicknav__chips-track" ref={trackRef}>
          {QUICK_NAV_ITEMS.map((item) => {
            const isActive = item.path === active
            return (
              <button
                key={item.path}
                type="button"
                className={`sc-quicknav__chip${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="sc-quicknav" role="navigation" aria-label="快捷导航">
      <Segmented
        value={active}
        onChange={(value) => navigate(String(value))}
        options={QUICK_NAV_ITEMS.map((item) => ({ value: item.path, label: item.label }))}
      />
    </div>
  )
}
