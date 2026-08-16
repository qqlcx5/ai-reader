import { describe, it, expect } from 'vitest'
import { mdToPlain, pickVoice } from './useTts'

describe('mdToPlain', () => {
  it('strips markdown syntax but keeps content', () => {
    const md = [
      '# 标题',
      '',
      '这是**加粗**和*斜体*内容。',
      '',
      '- 列表项一',
      '- 列表项二',
      '',
      '```js',
      'const a = 1',
      '```',
      '',
      '[链接文字](https://a.com) 和 ![图片](x.png)',
      '',
      '> 引用一行',
    ].join('\n')

    const plain = mdToPlain(md)
    expect(plain).toContain('标题')
    expect(plain).toContain('这是加粗和斜体内容。')
    expect(plain).toContain('列表项一')
    expect(plain).toContain('链接文字')
    expect(plain).toContain('引用一行')
    expect(plain).not.toContain('```')
    expect(plain).not.toContain('![')
    expect(plain).not.toContain('**')
    expect(plain).not.toContain('const a = 1')
  })
})

describe('pickVoice', () => {
  it('returns null without speechSynthesis', () => {
    expect(pickVoice('你好')).toBeNull()
  })
})
