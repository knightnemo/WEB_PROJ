package Impl

import Common.API.{PlanContext, TraceID}
import cats.effect.{IO, Ref}

import java.sql
import java.sql.{Connection, SQLException}

case class InitSchemaMessagePlanner(schemaName: String,override val planContext: PlanContext) extends DBPlanner[String]:
  override def planWithConnection(connection: Connection, connectionMap: Ref[IO, Map[String, Connection]]): IO[String] = IO.delay{
    // Sanitize and validate the schema name to prevent SQL injection
    // This regex is an example; adjust it according to your schema naming rules
    if (!schemaName.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
      throw new IllegalArgumentException("Invalid schema name")
    }
    val schemaStmt = connection.createStatement()
    try {
      // Since we cannot use PreparedStatement for CREATE SCHEMA, validate input strictly
      schemaStmt.executeUpdate(s"CREATE SCHEMA IF NOT EXISTS $schemaName;")
      s"Schema $schemaName created"
    }  catch {
      case e: SQLException =>
        println(s"SQL exception occurred: ${e.getMessage}")
        "Failed to create schema due to an SQL exception."
      case e: Exception =>
        println(s"An exception occurred: ${e.getMessage}")
        "Failed to create schema due to a general exception."
    } finally {
      schemaStmt.close() // Ensure the Statement is closed after use
    }
  }