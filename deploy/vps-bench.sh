#!/usr/bin/env bash
# ============================================================================
# VPS 到货验收脚本（72 小时退款窗口内跑完）
#
# 用法：在新买的 VPS 上以 root 执行
#   bash vps-bench.sh
#
# 为什么需要它：低价年付 VPS 的标称配置（几核几 G）参考价值有限，
# 真正决定「能不能流畅跑」的是三件事 ——
#   1) CPU steal time（宿主机超售程度）
#   2) 磁盘 4K 随机 IOPS（SQLite 并发写入的真实瓶颈）
#   3) 到目标客群的真实网络延迟
# 本脚本只读不写，不会改动系统配置（临时文件跑完即删）。
# ============================================================================
set -uo pipefail

TMP=/tmp/.vpsbench.$$
PASS=0
WARN=0
FAIL=0

grade() { # grade <值> <good> <warn> <说明>  —— 越小越好
  local v=$1 g=$2 w=$3 label=$4
  if awk "BEGIN{exit !($v <= $g)}"; then
    echo "    ✅ $label：$v"; PASS=$((PASS+1))
  elif awk "BEGIN{exit !($v <= $w)}"; then
    echo "    ⚠  $label：$v（偏高，可接受但需观察）"; WARN=$((WARN+1))
  else
    echo "    ❌ $label：$v（不达标，建议申请退款/换机）"; FAIL=$((FAIL+1))
  fi
}

echo "=============================================================="
echo " VPS 验收报告  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=============================================================="

echo ""
echo "==> 1. 基础信息"
echo "    CPU：$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs)"
echo "    核心数：$(nproc)"
echo "    内存：$(free -h | awk '/Mem/{print $2}')   Swap：$(free -h | awk '/Swap/{print $2}')"
echo "    磁盘：$(df -h / | awk 'NR==2{print $2" 总 / "$4" 可用"}')"
echo "    系统：$(. /etc/os-release && echo $PRETTY_NAME)"
echo "    虚拟化：$(systemd-detect-virt 2>/dev/null || echo unknown)"

echo ""
echo "==> 2. CPU 超售检测（steal time，最关键指标）"
# vmstat 的 st 列 = 被宿主机抢走的 CPU 时间占比
ST=$(vmstat 1 5 2>/dev/null | tail -4 | awk '{s+=$17; n++} END{if(n)printf "%.1f", s/n; else print 0}')
echo "    连续 4 秒平均 steal：${ST}%"
grade "$ST" 2 8 "steal time(%)"

echo ""
echo "==> 3. 单核性能（AES-128-CBC 吞吐，越高越好）"
AES=$(openssl speed -evp aes-128-cbc -seconds 2 2>/dev/null | awk '/^aes-128-cbc/{print $(NF-1)}' | tail -1)
if [ -n "${AES:-}" ]; then
  echo "    单核 AES 吞吐：${AES} kbytes/s"
  # 参考：老旧共享核 ~200000，现代 EPYC/Xeon ~600000+
  if awk "BEGIN{exit !($AES >= 500000)}"; then
    echo "    ✅ 单核性能正常（接近现代服务器水平）"; PASS=$((PASS+1))
  elif awk "BEGIN{exit !($AES >= 350000)}"; then
    echo "    ⚠  单核性能中等（老架构或轻微超售，静态站仍可用）"; WARN=$((WARN+1))
  else
    echo "    ❌ 单核性能偏低（老架构或严重超售）"; FAIL=$((FAIL+1))
  fi
else
  echo "    ⚠  无法测试（openssl 不可用），跳过"
fi

echo ""
echo "==> 4. 磁盘随机 IOPS（4K，SQLite 的真实瓶颈）"
dd if=/dev/zero of=$TMP bs=4k count=8000 oflag=direct 2>/dev/null
W_SEC=$(dd if=$TMP of=/dev/null bs=4k count=8000 iflag=direct 2>&1 | grep -oE '[0-9.]+ s' | tr -d ' s')
IOPS=$(awk "BEGIN{printf \"%.0f\", 8000/$W_SEC}")
echo "    4K 随机读：${IOPS} IOPS（顺序读 ${W_SEC}s / 8000 块）"
# 参考：SATA SSD 约 15000-40000，NVMe 约 60000+，机械盘 <1000
grade "$(awk "BEGIN{print 60000/$IOPS}")" 4 10 "读放大系数(越小越好)"
rm -f $TMP

echo ""
echo "==> 5. 网络延迟（到目标客群区域）"
pingtest() {
  local host=$1 label=$2
  local rtt
  rtt=$(ping -c 5 -W 2 -q "$host" 2>/dev/null | awk -F'/' '/rtt|round-trip/{print $5}')
  if [ -n "$rtt" ]; then
    printf "    %-22s %s ms\n" "$label" "$rtt"
    echo "$rtt"
  else
    printf "    %-22s 超时/不可达\n" "$label"
    echo "999"
  fi
}
echo "    （仅供参考，anycast 目标不代表地理距离）"
R_CF=$(pingtest speed.cloudflare.com "Cloudflare 边缘")
R_GOOGLE=$(pingtest 8.8.8.8 "Google DNS")
R_QUAD=$(pingtest 9.9.9.9 "Quad9 DNS")
echo "    提示：准确的欧美客户延迟请用第三方多点测速（如 ping.pe）从伦敦/法兰克福/纽约发起"

echo ""
echo "==> 6. 磁盘空间占用预估（本站在此机上的实际需求）"
echo "    站点代码 + 媒体：约 75 MB"
echo "    Docker 运行时：约 1.0 GB"
echo "    系统 + 缓存：约 2.5 GB"
echo "    留 30% 余量后建议可用空间 ≥ 6 GB，当前可用：$(df -h / | awk 'NR==2{print $4}')"

echo ""
echo "=============================================================="
echo " 判定：通过 $PASS · 警告 $WARN · 不通过 $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo " ❌ 存在不达标项 —— 72 小时退款窗口内尽快申请退款或换机"
elif [ "$WARN" -gt 0 ]; then
  echo " ⚠  可用，但有偏高项 —— 建议部署后持续观察一周"
else
  echo " ✅ 各项达标，可以正式部署"
fi
echo "=============================================================="
echo ""
echo "下一步："
echo "  1) bash deploy/server-init.sh   （swap / 防火墙 / Docker）"
echo "  2) 本地 bash deploy/deploy.sh   （部署站点）"
echo "  3) 检查 IP 是否在黑名单：https://www.abuseipdb.com/check/<你的IP>"
echo "     免费 VPS 的 IP 段常被滥用过，进黑名单会影响 Google 收录与客户信任"
