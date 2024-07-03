package Impl

import Common.API.{PlanContext, TraceID}
import cats.effect.{IO, Ref}

import java.sql.Connection


// EndTransactionMessage case class for committing or rolling back a transaction
case class EndTransactionMessagePlanner(commit: Boolean,override val planContext: PlanContext) extends DBPlanner[String] {
  override def planWithConnection(connection: Connection, connectionMap: Ref[IO, Map[String, Connection]]): IO[String] = {
    IO.delay(if (commit) {
      // Commit the transaction if operations were successful
      connection.commit()
      // Reset auto-commit to true after the transaction has ended
      connection.setAutoCommit(true)
      "Transaction committed successfully."
    } else {
      // Roll back the transaction if there were any problems
      connection.rollback()
      // Reset auto-commit to true after the transaction has ended
      connection.setAutoCommit(true)
      "Transaction rolled back successfully."
    }).flatMap(
      result=>
        /** 目前考虑，当transaction结束之后，就把这个connection关掉了 */
        IO(connection.close())>>
        IO(connectionMap.update(_ - this.planContext.traceID.id)) >>
        IO(result)
    )
  }
}