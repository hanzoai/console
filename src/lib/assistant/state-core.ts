/**
 * The one correction the console makes to a classified failure, kept pure so it is
 * unit-tested without the UI package the classifier ships in.
 *
 * A 401 means the request was refused. The shared classifier can only read the
 * status, so it explains every 401 the one way that fits a signed-out caller: your
 * session expired, sign in again. Told to someone whose session is live, that is
 * false twice over — it blames the user for the app's own fault (the assistant's
 * completions call was sending no credential at all) and it sends them to
 * re-authenticate, which cannot help.
 *
 * Whether the session is live is a fact only this app holds, so it is decided here.
 */
import { type BackendState } from '@hanzo/ui/product'

/**
 * `state` as it should read given `expiresIn`, the seconds left on the access token
 * (null when there is none, or it has lapsed).
 *
 * With a live token a 401 becomes `access`: a signed-in caller this surface refused,
 * which is what actually happened. With no live token `signin` is true and stands.
 * Every other kind is already right and passes through untouched, and the backend's
 * own message is carried either way — nothing here invents copy.
 */
export function honest(state: BackendState, expiresIn: number | null): BackendState {
  if (state.kind !== 'signin') return state
  return expiresIn ? { ...state, kind: 'access' } : state
}
