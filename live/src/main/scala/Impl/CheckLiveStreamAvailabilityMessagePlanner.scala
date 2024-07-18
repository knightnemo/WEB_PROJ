package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.CheckLiveStreamAvailabilityMessage
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._

case class CheckLiveStreamAvailabilityMessagePlanner(
                                                      message: CheckLiveStreamAvailabilityMessage,
                                                      override val planContext: PlanContext
                                                    ) extends Planner[Boolean]:

  override def plan(using PlanContext): IO[Boolean] = {
    val CheckLiveStreamAvailabilityMessage(name, slotNumber) = message

    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT slot${slotNumber}
         |FROM ${schemaName}.live_streams
         |WHERE name = ?
      """.stripMargin,
      List(
        SqlParameter("String", name)
      )
    )

    readMessage.send.flatMap { rows =>
      rows.headOption match {
        case Some(row) =>
          IO.fromEither(
            row.hcursor.get[String](s"slot$slotNumber").map(_ == "0")
          )
        case None =>
          IO.raiseError(new Exception(s"Live stream with name: $name not found"))
      }
    }
  }