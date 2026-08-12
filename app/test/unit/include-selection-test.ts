import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getFilesForIncludeToggle } from '../../src/lib/fork/include-selection'
import {
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
  AppFileStatusKind,
} from '../../src/models/status'
import { DiffSelectionType, DiffSelection } from '../../src/models/diff'

const file = (path: string, included: boolean) =>
  new WorkingDirectoryFileChange(
    path,
    { kind: AppFileStatusKind.Modified, submoduleStatus: undefined },
    DiffSelection.fromInitialSelection(
      included ? DiffSelectionType.All : DiffSelectionType.None
    )
  )

const asPaths = (
  result: WorkingDirectoryFileChange | ReadonlyArray<WorkingDirectoryFileChange>
) => (Array.isArray(result) ? result.map(f => f.path) : [(result as any).path])

describe('getFilesForIncludeToggle', () => {
  const a = file('a.txt', false)
  const b = file('b.txt', true)
  const c = file('c.txt', false)
  const workingDirectory = WorkingDirectoryStatus.fromFiles([a, b, c])

  it('affects only the clicked file when nothing else is selected', () => {
    const result = getFilesForIncludeToggle(a, [a.id], workingDirectory)
    assert.deepEqual(asPaths(result), ['a.txt'])
  })

  it('affects only the clicked file when it is outside the selection', () => {
    const result = getFilesForIncludeToggle(c, [a.id, b.id], workingDirectory)
    assert.deepEqual(asPaths(result), ['c.txt'])
  })

  it('affects the whole selection when the clicked file is inside it', () => {
    const result = getFilesForIncludeToggle(
      a,
      [a.id, b.id, c.id],
      workingDirectory
    )
    assert.deepEqual(asPaths(result).sort(), ['a.txt', 'b.txt', 'c.txt'])
  })

  it('includes files that were already in the opposite state', () => {
    // The reported case: a mixed selection where the clicked file disagrees
    // with some of the others. All of them are returned, so the caller sets
    // them to one value rather than inverting each.
    const result = getFilesForIncludeToggle(a, [a.id, b.id], workingDirectory)
    assert.deepEqual(asPaths(result).sort(), ['a.txt', 'b.txt'])
  })

  it('falls back to the clicked file when no selected id resolves', () => {
    // Selection ids can go stale if the working directory changes between
    // render and click; acting on nothing would look like a broken checkbox.
    const result = getFilesForIncludeToggle(
      a,
      ['gone-1', 'gone-2'],
      WorkingDirectoryStatus.fromFiles([])
    )
    assert.deepEqual(asPaths(result), ['a.txt'])
  })

  it('drops selected ids that no longer resolve', () => {
    const result = getFilesForIncludeToggle(
      a,
      [a.id, 'gone', b.id],
      workingDirectory
    )
    assert.deepEqual(asPaths(result).sort(), ['a.txt', 'b.txt'])
  })
})
