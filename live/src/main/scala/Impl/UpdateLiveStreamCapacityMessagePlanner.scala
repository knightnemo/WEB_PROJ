package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI.WriteDBMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.UpdateLiveStreamCapacityMessage
import io.circe.generic.auto._
import io.circe.syntax._

case class UpdateLiveStreamCapacityMessagePlanner(
                                                   message: UpdateLiveStreamCapacityMessage,
                                                   override val planContext: PlanContext
                                                 ) extends Planner[String]:

  override def plan(using PlanContext): IO[String] = {
    val UpdateLiveStreamCapacityMessage(liveStreamId) = message

    val writeMessage = WriteDBMessage(
      s"""
         |UPDATE ${schemaName}.live_streams
         |SET capacity = capacity - 1
         |WHERE id = ? AND capacity > 0
        """.stripMargin,
      List(SqlParameter("String", liveStreamId))
    )

    IO.fromEither(writeMessage.asJson.as[WriteDBMessage]).flatMap { encodedMessage =>
      encodedMessage.send.attempt.flatMap {
        case Right(updatedRows) if updatedRows > "0" =>
          IO.pure(s"Live stream capacity updated successfully")
        case Right(_) =>
          IO.raiseError(new Exception("No available slots or live stream not found"))
        case Left(error) =>
          IO.raiseError(new Exception(s"Failed to update live stream capacity: ${error.getMessage}"))
      }
    }.handleErrorWith { error =>
      IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}"))
    }
  }