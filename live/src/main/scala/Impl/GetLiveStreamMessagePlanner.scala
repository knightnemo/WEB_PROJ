package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.LiveStreamAPI.{GetLiveStreamMessage, LiveStreamInfo}
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._

case class GetLiveStreamMessagePlanner(
                                        message: GetLiveStreamMessage,
                                        override val planContext: PlanContext
                                      ) extends Planner[LiveStreamInfo]:

  override def plan(using PlanContext): IO[LiveStreamInfo] = {
    val GetLiveStreamMessage(name) = message

    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT id, name, capacity, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8
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
            for {
              id <- row.hcursor.get[String]("id")
              name <- row.hcursor.get[String]("name")
              capacity <- row.hcursor.get[Int]("capacity")
              slot1 <- row.hcursor.get[String]("slot1")
              slot2 <- row.hcursor.get[String]("slot2")
              slot3 <- row.hcursor.get[String]("slot3")
              slot4 <- row.hcursor.get[String]("slot4")
              slot5 <- row.hcursor.get[String]("slot5")
              slot6 <- row.hcursor.get[String]("slot6")
              slot7 <- row.hcursor.get[String]("slot7")
              slot8 <- row.hcursor.get[String]("slot8")
            } yield LiveStreamInfo(id, name, capacity, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8)
          )
        case None =>
          IO.raiseError(new Exception(s"Live stream with name: $name not found"))
      }
    }
  }