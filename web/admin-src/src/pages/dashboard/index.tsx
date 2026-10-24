import { useEffect, useState } from 'react'
import { App, Card, Col, Row, Skeleton, Statistic, Table, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { get, fmtTime } from '../../api/client'
import type { DashboardData, Product } from '../../api/types'
import { ProductStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import type { ColumnsType } from 'antd/es/table'

// 仪表盘：真实统计 + 最近询价/最近产品
export default function Dashboard(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    get<DashboardData>('/admin/dashboard')
      .then(({ data: d }) => {
        if (alive) setData(d)
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recentInquiryCols: ColumnsType<DashboardData['recent_inquiries'][number]> = [
    { title: '姓名', dataIndex: 'name', width: 110, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    { title: '产品', dataIndex: 'product_name_snapshot', ellipsis: true, render: (v: string) => v || '—' },
    { title: '时间', dataIndex: 'created_at', width: 150, render: (v: string) => fmtTime(v) },
  ]

  const recentProductCols: ColumnsType<Product> = [
    {
      title: '产品',
      dataIndex: 'name',
      ellipsis: true,
      render: (v: string, r: Product) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {r.main_image ? (
            <img src={r.main_image.url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <span style={{ width: 32, height: 32, background: '#F1F3F6', borderRadius: 4 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
        </span>
      ),
    },
    { title: 'SKU', dataIndex: 'sku', width: 110, render: (v: string) => v || '—' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: Product['status']) => <ProductStatusTag status={v} /> },
    { title: '更新时间', dataIndex: 'updated_at', width: 150, render: (v: string) => fmtTime(v) },
  ]

  return (
    <div>
      <PageHeader title="仪表盘" description="站点实时数据总览" />
      {loading || !data ? (
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" hoverable onClick={() => navigate('/admin/products?status=published')}>
                <Statistic title="已发布产品" value={data.products.published} valueStyle={{ color: '#0369A1' }} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" hoverable onClick={() => navigate('/admin/products?status=draft')}>
                <Statistic title="草稿产品" value={data.products.draft} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small" hoverable onClick={() => navigate('/admin/products?status=archived')}>
                <Statistic title="已归档产品" value={data.products.archived} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card size="small">
                <Statistic title="工艺内容" value={data.craftsmanship.published} suffix={`/ ${data.craftsmanship.total} 已发布`} />
              </Card>
            </Col>
            <Col xs={12} md={8} lg={4}>
              <Card
                size="small"
                hoverable
                style={{ background: '#FCEBEC', borderColor: '#F5C8CA' }}
                onClick={() => navigate('/admin/inquiries?status=new')}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <Statistic
                  title={<span style={{ color: '#D9535D' }}>新询价</span>}
                  value={data.inquiries.new}
                  valueStyle={{ color: '#D9535D' }}
                  suffix={<ArrowRightOutlined style={{ fontSize: 14 }} />}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title="最近询价"
                extra={
                  <Typography.Link onClick={() => navigate('/admin/inquiries')}>
                    查看全部
                  </Typography.Link>
                }
              >
                <Table
                  size="small"
                  rowKey="id"
                  columns={recentInquiryCols}
                  dataSource={data.recent_inquiries}
                  pagination={false}
                  onRow={() => ({ onClick: () => navigate('/admin/inquiries'), style: { cursor: 'pointer' } })}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title="最近更新的产品"
                extra={
                  <Typography.Link onClick={() => navigate('/admin/products')}>
                    查看全部
                  </Typography.Link>
                }
              >
                <Table
                  size="small"
                  rowKey="id"
                  columns={recentProductCols}
                  dataSource={data.recent_products}
                  pagination={false}
                  onRow={(r) => ({
                    onClick: () => navigate(`/admin/products/${r.id}/edit`),
                    style: { cursor: 'pointer' },
                  })}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
