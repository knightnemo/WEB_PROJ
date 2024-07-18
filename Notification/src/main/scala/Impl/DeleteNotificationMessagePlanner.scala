package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class DeleteNotificationMessagePlanner(id: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    writeDB(
      s"DELETE FROM ${schemaName}.notifications WHERE id = ?",
      List(SqlParameter("String", id))
    ).attempt.flatMap {
      case Right(_) => IO.pure(s"Notification deletion operation completed for ID: $id")
      case Left(error) =>
        IO.raiseError(new Exception(s"Failed to delete notification: ${error.getMessage}"))
    }
  }