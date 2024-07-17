package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI._
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
    val UpdateLiveStreamMessage(name, capacity, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8) = message

    val writeMessage = WriteDBMessage(
      s"""UPDATE ${schemaName}.live_streams
         |SET capacity = ?, slot1 = ?, slot2 = ?, slot3 = ?, slot4 = ?,
         |    slot5 = ?, slot6 = ?, slot7 = ?, slot8 = ?
         |WHERE name = ?""".stripMargin,
      List(
        SqlParameter("Int", capacity.toString),
        SqlParameter("String", slot1),
        SqlParameter("String", slot2),
        SqlParameter("String", slot3),
        SqlParameter("String", slot4),
        SqlParameter("String", slot5),
        SqlParameter("String", slot6),
        SqlParameter("String", slot7),
        SqlParameter("String", slot8),
        SqlParameter("String", name)
      )
    )

    writeMessage.asJson.as[WriteDBMessage].fold(
      error => IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}")),
      encodedMessage => encodedMessage.send.attempt.flatMap {
        case Right(_) => IO.pure(s"Live stream with name: $name updated successfully")
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to update live stream: ${error.getMessage}"))
      }
    )
  }