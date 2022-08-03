package expo.modules.updates.logging

import android.content.Context
import java.lang.Error
import java.util.*

/**
 * Class for reading expo-updates logs
 */
class UpdatesLogReader(
  private val context: Context
) {

  /**
   * Purge expo-updates logs older than the given date
   */
  fun purgeLogEntries(olderThan: Date, completionHandler: ((_: Error?) -> Unit)) {
    val epochTimestamp = olderThan.time
    persistentLog.filterEntries(
      { entryString -> entryLaterThanTimestamp(entryString, epochTimestamp) },
      {
        completionHandler(it)
      }
    )
  }

  /**
   Get expo-updates logs newer than the given date
   Returns a list of strings in the JSON format of UpdatesLogEntry
   */
  fun getLogEntries(newerThan: Date): List<String> {
    val epochTimestamp = newerThan.time
    return persistentLog.readEntries()
      .mapNotNull { entryString -> UpdatesLogEntry.create(entryString) }
      .filter { entry -> entry.timestamp >= epochTimestamp }
      .map { entry -> entry.asString() }
  }

  private val persistentLog = UpdatesPersistentLog(context)

  private fun entryLaterThanTimestamp(entryString: String, timestamp: Long): Boolean {
    val entry = UpdatesLogEntry.create(entryString)
    return when (entry) {
      null -> false
      else -> {
        entry.timestamp >= timestamp
      }
    }
  }
}
