import { useState } from 'react'
import { App, Form, Input, Modal } from 'antd'
import { post } from '../api/client'

// 修改密码：≥10 位且含字母数字（与后端校验一致）
export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await post('/admin/change-password', { current: values.current, new: values.next })
      message.success('密码已修改，其他会话已失效')
      form.resetFields()
      onClose()
    } catch (e) {
      const err = e as { fields?: Record<string, string>; message?: string }
      if (err.fields) {
        form.setFields(
          Object.entries(err.fields).map(([nameKey, msg]) => {
            const name = nameKey === 'current' ? 'current' : 'next'
            return { name, errors: [msg] }
          }),
        )
      } else if (err.message) {
        message.error(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      onOk={() => void submit()}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="current" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="next"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 10, message: '至少 10 位' },
            {
              validator: (_, v: string) =>
                v && !(/[A-Za-z]/.test(v) && /[0-9]/.test(v))
                  ? Promise.reject(new Error('须同时包含字母和数字'))
                  : Promise.resolve(),
            },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
          dependencies={['next']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator: (_, v: string) =>
                v !== getFieldValue('next') ? Promise.reject(new Error('两次输入不一致')) : Promise.resolve(),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
