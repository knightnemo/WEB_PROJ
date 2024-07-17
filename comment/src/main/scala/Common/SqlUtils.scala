package Common

import scala.util.matching.Regex

object SqlUtils {
  private val validIDentifierPattern: Regex = "^[a-zA-Z_][a-zA-Z0-9_]*$".r
  private val reservedSqlKeywords: Set[String] = Set(
    "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TABLE"
    // Add all other reserved SQL keywords that are relevant for your DBMS
  )

  def isTableNameSafe(tableName: String): Boolean = {
    // Split the fully qualified table name into schema and table components
    val parts = tableName.split("\\.", -1)

    // Check that there are either one or two parts (table or schema.table) and all parts are valid
    parts.nonEmpty && parts.length <= 2 && parts.forall { part =>
      validIDentifierPattern.findFirstIn(part).isDefined &&
        !reservedSqlKeywords.contains(part.toUpperCase)
    }
  }
}