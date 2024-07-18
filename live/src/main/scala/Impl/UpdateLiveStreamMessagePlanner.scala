package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI.WriteDBMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.UpdateLiveStreamMessage
import io.circe.generic.auto._
import io.circe.syntax._

case class UpdateLiveStreamMessagePlanner(
                                           message: UpdateLiveStreamMessage,
                                           override val planContext: PlanContext
                                         ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val UpdateLiveStreamMessage(name, classroom, teacher, slot, capacity, enrolledCount) = message

    val writeMessage = WriteDBMessage(
      s"""
         |UPDATE ${schemaName}.live_streams
         |SET classroom = ?, teacher = ?, slot = ?, capacity = ?, enrolled_count = ?
         |WHERE name = ?
      """.stripMargin,
      List(
        SqlParameter("String", classroom),
        SqlParameter("String", teacher),
        SqlParameter("Int", slot.toString),
        SqlParameter("Int", capacity.toString),
        SqlParameter("Int", enrolledCount.toString),
        SqlParameter("String", name)
      )
    )

    writeMessage.asJson.as[WriteDBMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(updatedRows) if updatedRows > "0" =>
          IO.pure(s"Live stream updated successfully")
        case Right(_) =>
          IO.raiseError(new Exception("Live stream not found"))
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to update live stream: ${error.getMessage}"))
      }
    )
  }