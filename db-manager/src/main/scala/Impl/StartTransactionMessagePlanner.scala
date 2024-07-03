package Impl

import Common.API.{PlanContext, TraceID}
import cats.effect.{IO, Ref}

import java.sql.Connection

// StartTransactionMessage case class
case class StartTransactionMessagePlanner(override val planContext: PlanContext) extends DBPlanner[String] {
  override def planWithConnection(connection: Connection,connectionMap: Ref[IO, Map[String, Connection]]): IO[String] = IO.delay{
    // Set auto-commit to false to start a new transaction
    connection.setAutoCommit(false)
    "Transaction started"
  }
}