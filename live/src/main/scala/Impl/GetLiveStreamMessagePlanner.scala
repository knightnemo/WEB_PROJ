package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.GetLiveStreamMessage
import io.circe.generic.auto._
import io.circe.syntax._

case class GetLiveStreamMessagePlanner(
                                        message: GetLiveStreamMessage,
                                        override val planContext: PlanContext
                                      ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val GetLiveStreamMessage(name) = message

    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT id, name, classroom, teacher, slot
         |FROM ${schemaName}.live_streams
         |WHERE name = ?
      """.stripMargin,
      List(SqlParameter("String", name))
    )

    readMessage.asJson.as[ReadDBRowsMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode ReadDBRowsMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(rows) => rows.headOption match {
          case Some(row) =>
            IO.pure(row.asJson.noSpaces)
          case None =>
            IO.raiseError(new Exception(s"Live stream with name: $name not found"))
        }
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to get live stream: ${error.getMessage}"))
      }
    )
  }