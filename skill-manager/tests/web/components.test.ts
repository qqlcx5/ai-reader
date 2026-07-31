import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SkillDetail from '../../src/web/SkillDetail.vue'
import SkillFilters from '../../src/web/SkillFilters.vue'
import SkillList from '../../src/web/SkillList.vue'
import type { SkillRecord } from '../../src/core/schema'

const skill: SkillRecord = {
  id: 'research',
  slug: 'research',
  rawContent: { path: 'content/research.md', hash: 'a', lastSyncedAt: 'now' },
  metadata: {
    name: '研究助手',
    summary: '查找资料',
    categories: ['研究'],
    useCases: ['调研'],
    usage: '研究时使用',
    triggers: ['研究'],
  },
  metadataStatus: { generatedBy: 'human', reviewed: true },
  preferences: { enabled: true, favorite: false },
  sync: { status: 'up-to-date', lastCheckedAt: 'now' },
}

describe('SkillFilters', () => {
  it('emits typed filter updates and reset', async () => {
    const wrapper = mount(SkillFilters, {
      props: { query: '', category: '', enabled: '', favorite: false, categories: ['研究'] },
    })

    await wrapper.find('input[type="search"]').setValue('研究')
    await wrapper.find('select').setValue('研究')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:query')?.[0]).toEqual(['研究'])
    expect(wrapper.emitted('update:category')?.[0]).toEqual(['研究'])
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})

describe('SkillList', () => {
  it('emits selection and preference actions', async () => {
    const wrapper = mount(SkillList, { props: { skills: [skill] } })

    await wrapper.find('.skill-row').trigger('click')
    await wrapper.find('.icon-button').trigger('click')
    await wrapper.find('.status-button').trigger('click')

    expect(wrapper.emitted('select')?.[0]).toEqual(['research'])
    expect(wrapper.emitted('toggleFavorite')?.[0]).toEqual(['research'])
    expect(wrapper.emitted('toggleEnabled')?.[0]).toEqual(['research'])
  })
})

describe('SkillDetail', () => {
  it('emits edited metadata as reviewed content', async () => {
    const wrapper = mount(SkillDetail, { props: { skill, content: '# Research', saving: false } })

    await wrapper.find('input').setValue('研究工作台')
    await wrapper.find('form').trigger('submit')

    const saved = wrapper.emitted('save')?.[0]?.[0] as SkillRecord
    expect(saved.metadata.name).toBe('研究工作台')
    expect(saved.metadataStatus.reviewed).toBe(true)
    expect(saved.metadataStatus.generatedBy).toBe('human')
  })
})
