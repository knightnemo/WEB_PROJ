package Impl

import Common.API.{PlanContext, TraceID}
import Common.Object.SqlParameter
import cats.effect.{IO, Ref}
import org.joda.time.format.DateTimeFormat

import java.sql.{Connection, Timestamp}

case class ReadDBValueMessagePlanner(sqlQuery: String, parameters: List[SqlParameter],override val planContext: PlanContext) extends DBPlanner[String] {
  override def planWithConnection(connection: Connection, connectionMap: Ref[IO, Map[String, Connection]]): IO[String] = IO.delay{
    val preparedStatement = connection.prepareStatement(sqlQuery)
    println(preparedStatement)
    try {
      // Populate the prepared statement with parameters
      parameters.zipWithIndex.foreach { case (param, index) =>
        param.dataType.toLowerCase match {
          case "string"  => preparedStatement.setString(index + 1, param.value)
          case "int"     => preparedStatement.setInt(index + 1, param.value.toInt)
          case "boolean" => preparedStatement.setBoolean(index + 1, param.value.toBoolean)
          case "datetime" =>
            preparedStatement.setTimestamp(index + 1, new Timestamp(param.value.toLong)) // Convert DateTime to Timestamp          // Add more type cases as needed
          // Add more type cases as needed
          case _ => throw new IllegalArgumentException("Unsupported data type")
        }
      }
      println("!!")
      // Execute the query
      val resultSet = preparedStatement.executeQuery()
      if (resultSet.next()) {
        resultSet.getString(1) // Assuming the value you want is in the first column
      } else {
        throw new NoSuchElementException("No value found for the given query and parameters.")
      }
    } finally {
      preparedStatement.close() // Ensure the PreparedStatement is closed after use
    }
  }
}