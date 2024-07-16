package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class CreateNotificationMessagePlanner(
                                             id: String,
                                             title: String,
                                             content: String,
                                             publisher: String,
                                             publishTime: String,
                                             recipients: String,
                                             //override val planContext: PlanContext
                                           ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    writeDB(
      s"""INSERT INTO ${schemaName}.notifications
         |(id, title, content, publisher, publish_time, recipients)
         |VALUES (?, ?, ?, ?, ?, ?)""".stripMargin,
      List(
        SqlParameter("String", id),
        SqlParameter("String", title),
        SqlParameter("String", content),
        SqlParameter("String", publisher),
        SqlParameter("String", publishTime),
        SqlParameter("String", recipients)
      )
    ).attempt.flatMap {
      case Right(_) => IO.pure(s"Notification created successfully with ID: $id")
      case Left(error) =>
        IO.raiseError(new Exception(s"Failed to create notification: ${error.getMessage}"))
    }
  }