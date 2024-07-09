package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class PatientRegisterMessagePlanner(userName: String, password: String, bio: Option[String], override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    // Check if the user is already registered
    val checkUserExists = readDBBoolean(
      s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.user_name WHERE user_name = ?)",
      List(SqlParameter("String", userName))
    )

    checkUserExists.flatMap { exists =>
      if (exists) {
        IO.raiseError(new Exception("already registered"))
      } else {
        // Construct the list of parameters for inserting into user_name table
        val userParams = List(
          SqlParameter("String", userName),
          SqlParameter("String", password)
        )

        // If bio is defined, add it to the parameters list
        val userParamsWithBio = bio match {
          case Some(bioContent) => userParams :+ SqlParameter("String", bioContent)
          case None => userParams
        }

        // Execute the insertion into user_name table
        for {
          _ <- writeDB(
            s"INSERT INTO ${schemaName}.user_name (user_name, password, bio) VALUES (?, ?, ?)",
            userParamsWithBio
          )
        } yield "User registered successfully"
      }
    }
  }
