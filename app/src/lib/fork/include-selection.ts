import {
  WorkingDirectoryFileChange,
  WorkingDirectoryStatus,
} from '../../models/status'

/**
 * Which files a checkbox click in the changes list should apply to.
 *
 * Upstream toggles only the row whose checkbox was clicked, even when that row
 * is one of several selected. Selecting ten files and then having to tick them
 * one at a time is the wrong shape for what the selection was for.
 *
 * The rule matches the one the context menu already uses: act on the whole
 * selection when the clicked row is part of it, and on the single row when it
 * is not.
 *
 * Note this is not a per-file toggle. The caller passes the value the user
 * just chose and every affected file is set to it, so ticking one unchecked
 * row in a mixed selection checks all of them. Inverting each file instead
 * would leave the selection just as mixed as it started, which is never what
 * the click was asking for.
 */
export function getFilesForIncludeToggle(
  file: WorkingDirectoryFileChange,
  selectedFileIDs: ReadonlyArray<string>,
  workingDirectory: WorkingDirectoryStatus
): WorkingDirectoryFileChange | ReadonlyArray<WorkingDirectoryFileChange> {
  if (selectedFileIDs.length < 2 || !selectedFileIDs.includes(file.id)) {
    return file
  }

  const files = selectedFileIDs
    .map(id => workingDirectory.findFileWithID(id))
    .filter((f): f is WorkingDirectoryFileChange => f !== null)

  // A selection whose ids no longer resolve (files vanished from the working
  // directory between render and click) would otherwise apply to nothing at
  // all, which reads as the checkbox being broken.
  return files.length > 0 ? files : file
}
