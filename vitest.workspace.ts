import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/*',
  'apps/*',
  'testing/functional/*',
  'testing/non-functional/*',
  'testing/quality/*',
  'testing/shared/*'
])
